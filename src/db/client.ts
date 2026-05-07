// Singleton do Prisma Client
// NOTA: Requer `npx prisma generate` após setup da DB para gerar os tipos correctos.
// Enquanto a DB não estiver migrada, o @prisma/client pode não ter os tipos gerados —
// nesse caso executar: npx prisma generate

// @ts-ignore — PrismaClient requer `prisma generate` para gerar tipos; ignorar até ao setup da DB
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env["NODE_ENV"] === "development"
        ? ["query", "error"]
        : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = prisma;
}
