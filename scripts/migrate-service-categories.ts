/**
 * One-time data migration for existing databases that still have the old flat
 * Service model (marketing fields on services, service_slug on FAQs/care).
 *
 * Prefer a clean `prisma db push` + `npm run db:seed` on empty environments.
 * Run this only when you need to preserve appointments/clients:
 *
 *   npx tsx scripts/migrate-service-categories.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { databaseUrl, hasDatabase, normalizeDatabaseUrl } from "../src/lib/db";

if (!hasDatabase()) throw new Error("DATABASE_URL is required");

const adapter = new PrismaPg({
  connectionString: databaseUrl() || normalizeDatabaseUrl(process.env.DATABASE_URL || ""),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  // If categories already exist, assume migration is done.
  const existing = await prisma.serviceCategory.count();
  if (existing > 0) {
    console.log(`service_categories already has ${existing} rows — skipping.`);
    return;
  }

  console.log(
    "This script expects the new Prisma schema to already be pushed.\n" +
      "If you still have the old schema, run a manual SQL migration first, then re-seed.\n" +
      "Recommended for empty/dev DBs: prisma db push --force-reset && npm run db:seed",
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
