import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Silence pg deprecation: sslmode=require is currently an alias of verify-full.
 * Opt into libpq-compatible require semantics until drivers change.
 * @see https://www.postgresql.org/docs/current/libpq-ssl.html
 */
export function normalizeDatabaseUrl(url: string) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("uselibpqcompat")) {
      parsed.searchParams.set("uselibpqcompat", "true");
    }
    if (!parsed.searchParams.get("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Neon/Vercel often inject POSTGRES_URL; Prisma/scripts use DATABASE_URL. */
export function databaseUrl() {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    "";
  return normalizeDatabaseUrl(raw);
}

export function hasDatabase() {
  return Boolean(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED ||
      process.env.POSTGRES_URL_NON_POOLING,
  );
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
