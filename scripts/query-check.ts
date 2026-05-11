import { prisma } from './src/db/client';

async function main() {
  const logs = await prisma.dietLog.findMany({
    where: { userId: 'cmow4rwtn0000sktzgyi5uyqr' }
  });
  console.log(JSON.stringify(logs, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
