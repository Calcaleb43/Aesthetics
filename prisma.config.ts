import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx scripts/seed.ts",
  },
  datasource: {
    // Fallback lets `prisma generate` run without a live database.
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/aniekanvas",
  },
});
