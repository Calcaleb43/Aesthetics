import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import seed from "../src/lib/content/seed-data.json";
import { databaseUrl, hasDatabase, normalizeDatabaseUrl } from "../src/lib/db";

if (!hasDatabase()) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl() || normalizeDatabaseUrl(process.env.DATABASE_URL || ""),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@aniekanvas.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "aniekanvas-admin";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.admin.upsert({
    where: { email },
    create: {
      email,
      name: "Admin",
      passwordHash,
      role: "owner",
      active: true,
      color: "#c6a75e",
    },
    update: {
      passwordHash,
      name: "Admin",
      role: "owner",
      active: true,
    },
  });

  await prisma.siteSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...seed.siteSettings,
      galleryImages: seed.siteSettings.galleryImages,
      values: seed.siteSettings.values,
      weeklyHours: seed.siteSettings.weeklyHours,
    },
    update: {
      ...seed.siteSettings,
      galleryImages: seed.siteSettings.galleryImages,
      values: seed.siteSettings.values,
      weeklyHours: seed.siteSettings.weeklyHours,
    },
  });

  for (const page of seed.pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      create: {
        slug: page.slug,
        title: page.title,
        status: page.status,
        excerpt: page.excerpt || "",
        content: page.content,
        seoTitle: page.seoTitle,
        coverImage: page.coverImage,
      },
      update: {
        title: page.title,
        status: page.status,
        excerpt: page.excerpt || "",
        content: page.content,
        seoTitle: page.seoTitle,
        coverImage: page.coverImage,
      },
    });
  }

  const categoryIdBySlug = new Map<string, string>();

  for (const category of seed.categories) {
    const row = await prisma.serviceCategory.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        title: category.title,
        shortTitle: category.shortTitle,
        tagline: category.tagline,
        summary: category.summary,
        content: category.content,
        coverImage: category.coverImage,
        bookingUrl: category.bookingUrl,
        sortOrder: category.sortOrder,
        status: category.status,
        featured: category.featured ?? true,
      },
      update: {
        title: category.title,
        shortTitle: category.shortTitle,
        tagline: category.tagline,
        summary: category.summary,
        content: category.content,
        coverImage: category.coverImage,
        bookingUrl: category.bookingUrl,
        sortOrder: category.sortOrder,
        status: category.status,
        featured: category.featured ?? true,
      },
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  for (const service of seed.services) {
    const categoryId = categoryIdBySlug.get(service.categorySlug);
    if (!categoryId) {
      throw new Error(`Missing category for service ${service.slug}: ${service.categorySlug}`);
    }
    await prisma.service.upsert({
      where: { slug: service.slug },
      create: {
        categoryId,
        slug: service.slug,
        title: service.title,
        summary: service.summary || "",
        sortOrder: service.sortOrder,
        status: service.status,
        durationMinutes: service.durationMinutes ?? 60,
        priceCents: service.priceCents ?? 0,
        depositCents: service.depositCents ?? null,
        paymentMode: service.paymentMode ?? "deposit",
        bookable: service.bookable ?? true,
      },
      update: {
        categoryId,
        title: service.title,
        summary: service.summary || "",
        sortOrder: service.sortOrder,
        status: service.status,
        durationMinutes: service.durationMinutes ?? 60,
        priceCents: service.priceCents ?? 0,
        depositCents: service.depositCents ?? null,
        paymentMode: service.paymentMode ?? "deposit",
        bookable: service.bookable ?? true,
      },
    });
  }

  for (const faq of seed.faqs) {
    await prisma.faq.upsert({
      where: { categorySlug: faq.categorySlug },
      create: {
        categorySlug: faq.categorySlug,
        title: faq.title,
        intro: faq.intro,
        status: faq.status,
        items: faq.items as Prisma.InputJsonValue,
      },
      update: {
        title: faq.title,
        intro: faq.intro,
        status: faq.status,
        items: faq.items as Prisma.InputJsonValue,
      },
    });
  }

  for (const guide of seed.careGuides) {
    await prisma.careGuide.upsert({
      where: { categorySlug: guide.categorySlug },
      create: {
        categorySlug: guide.categorySlug,
        title: guide.title,
        content: guide.content,
        coverImage: guide.coverImage,
        status: guide.status,
      },
      update: {
        title: guide.title,
        content: guide.content,
        coverImage: guide.coverImage,
        status: guide.status,
      },
    });
  }

  const mediaUrls = [seed.siteSettings.heroImage, ...seed.siteSettings.galleryImages];
  for (const url of mediaUrls) {
    await prisma.mediaAsset.create({
      data: {
        url,
        label: "Imported from Squarespace",
        alt: "Aniekanvas Aesthetics",
      },
    });
  }

  const { backfillClientsFromAppointments } = await import("../src/lib/booking/clients");
  const backfill = await backfillClientsFromAppointments(prisma);
  console.log(`Clients backfill: ${backfill.clients} clients, ${backfill.linked} appointments linked`);

  console.log("Seed complete");
  console.log(`Admin login: ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
