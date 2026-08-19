import { PrismaClient } from "@prisma/client";
import { assertDatabaseEnvironmentSafety } from "@/lib/database-safety";

assertDatabaseEnvironmentSafety();

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function runtimeDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || !process.env.VERCEL) return value;

  const url = new URL(value);
  url.searchParams.set("connection_limit", process.env.DATABASE_CONNECTION_LIMIT || "1");
  url.searchParams.set("pool_timeout", process.env.DATABASE_POOL_TIMEOUT || "30");
  return url.toString();
}

const databaseUrl = runtimeDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl ? { db: { url: databaseUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
