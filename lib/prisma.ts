import { PrismaClient } from "@prisma/client";

/**
 * Reuse a single Prisma client across hot-reloads in development.
 *
 * Without this, every `next dev` reload creates a new connection and
 * quickly exhausts the database connection pool.
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
