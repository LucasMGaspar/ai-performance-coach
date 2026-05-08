import { prisma } from './src/db/client.ts';
import { redisService } from './src/services/redis.service.ts';

async function run() {
  const users = await prisma.user.findMany();
  
  for (const user of users) {
    if (user.phoneNumber === '5527998353044' || user.name === 'Maria' || user.name === 'Maria Julya') {
      console.log(`Keeping Maria: ${user.phoneNumber}`);
      continue;
    }
    
    console.log(`Deleting user: ${user.name || 'Unknown'} (${user.phoneNumber})`);
    
    // Delete related records first
    await prisma.dailyCheckIn.deleteMany({ where: { userId: user.id } });
    await prisma.dietLog.deleteMany({ where: { userId: user.id } });
    await prisma.workoutLog.deleteMany({ where: { userId: user.id } });
    await prisma.scheduledMeal.deleteMany({ where: { userId: user.id } });
    
    // Delete user
    await prisma.user.delete({ where: { id: user.id } });
    
    // Clear redis session if it exists
    if (user.phoneNumber) {
      await redisService.clearSession(user.phoneNumber);
    }
  }
  
  console.log("Cleanup complete.");
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
