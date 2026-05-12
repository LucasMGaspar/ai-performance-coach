import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres:ekkogalus1324@db.hbhxaosefziohrsrxldj.supabase.co:5432/postgres"
    }
  }
});

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: 'Lucas', mode: 'insensitive' } }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log(`Cleaning data for user: ${user.name} (${user.id})`);

  const diet = await prisma.dietLog.deleteMany({ where: { userId: user.id } });
  const workout = await prisma.workoutLog.deleteMany({ where: { userId: user.id } });
  const checkins = await prisma.dailyCheckIn.deleteMany({ where: { userId: user.id } });
  const prs = await prisma.exercisePR.deleteMany({ where: { userId: user.id } });

  console.log(`Deleted: ${diet.count} diet logs, ${workout.count} workout logs, ${checkins.count} check-ins, ${prs.count} PRs`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
