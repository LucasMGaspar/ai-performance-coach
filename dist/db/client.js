import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
const globalForPrisma = globalThis;
function createPrismaClient() {
    const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}
export const prisma = globalForPrisma.prisma ?? createPrismaClient();
if (process.env["NODE_ENV"] !== "production") {
    globalForPrisma.prisma = prisma;
}
//# sourceMappingURL=client.js.map