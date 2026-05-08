import { prisma } from './src/db/client.ts';
import { redisService } from './src/services/redis.service.ts';

async function run() {
  const daniels = await prisma.user.findMany({
    where: {
      phoneNumber: '5527997563869'
    }
  });
  
  if (daniels.length === 0) {
    console.log("Daniel not found in database.");
  }

  for (const user of daniels) {
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
  
  // Clear session forcefully just in case user is not in DB but is in Redis
  await redisService.clearSession('5527997563869');
  
  console.log("Cleanup complete.");
  await prisma.$disconnect();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
