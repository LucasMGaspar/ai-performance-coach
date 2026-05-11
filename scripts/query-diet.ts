import { prisma } from './src/db/client';

async function main() {
  await prisma.dietLog.delete({
    where: { id: 'cmow5i12r000czctzyvhu1wy8' }
  });
  console.log("Almoço deleted successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
