import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Neon/Vercel often inject POSTGRES_URL; Prisma/scripts use DATABASE_URL. */
export function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  );
}

export function hasDatabase() {
  return Boolean(databaseUrl());
}

export function getPrisma() {
  const connectionString = databaseUrl();
  if (!connectionString) {
    throw new Error("DATABASE_URL (or POSTGRES_URL) is not set");
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg({
      connectionString,
    });
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }

  return globalForPrisma.prisma;
}

export type Database = PrismaClient;
