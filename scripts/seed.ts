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
    create: { email, name: "Admin", passwordHash },
    update: { passwordHash, name: "Admin" },
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

  for (const service of seed.services) {
    const booking = service as typeof service & {
      durationMinutes?: number;
      priceCents?: number;
      depositCents?: number | null;
      paymentMode?: string;
      bookable?: boolean;
      featured?: boolean;
    };
    await prisma.service.upsert({
      where: { slug: service.slug },
      create: {
        slug: service.slug,
        title: service.title,
        shortTitle: service.shortTitle,
        tagline: service.tagline,
        summary: service.summary,
        content: service.content,
        coverImage: service.coverImage,
        bookingUrl: service.bookingUrl,
        sortOrder: service.sortOrder,
        status: service.status,
        featured: booking.featured ?? true,
        durationMinutes: booking.durationMinutes ?? 60,
        priceCents: booking.priceCents ?? 0,
        depositCents: booking.depositCents ?? null,
        paymentMode: booking.paymentMode ?? "deposit",
        bookable: booking.bookable ?? true,
      },
      update: {
        title: service.title,
        shortTitle: service.shortTitle,
        tagline: service.tagline,
        summary: service.summary,
        content: service.content,
        coverImage: service.coverImage,
        bookingUrl: service.bookingUrl,
        sortOrder: service.sortOrder,
        status: service.status,
        featured: booking.featured ?? true,
        durationMinutes: booking.durationMinutes ?? 60,
        priceCents: booking.priceCents ?? 0,
        depositCents: booking.depositCents ?? null,
        paymentMode: booking.paymentMode ?? "deposit",
        bookable: booking.bookable ?? true,
      },
    });
  }

  for (const faq of seed.faqs) {
    await prisma.faq.upsert({
      where: { serviceSlug: faq.serviceSlug },
      create: {
        serviceSlug: faq.serviceSlug,
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
      where: { serviceSlug: guide.serviceSlug },
      create: {
        serviceSlug: guide.serviceSlug,
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
