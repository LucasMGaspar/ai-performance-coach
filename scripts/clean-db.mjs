import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({
    include: {
      _count: {
        select: { workoutLogs: true }
      }
    }
  });
  console.table(users.map(u => ({ id: u.id, name: u.name, phone: u.phoneNumber, workouts: u._count.workoutLogs })));
  
  // Find users with 0 workouts
  const usersToDelete = users.filter(u => u._count.workoutLogs === 0).map(u => u.id);
  
  if (usersToDelete.length > 0) {
    console.log("Deleting users without workouts:", usersToDelete.length);
    await prisma.scheduledMeal.deleteMany({ where: { userId: { in: usersToDelete } } });
    await prisma.dietLog.deleteMany({ where: { userId: { in: usersToDelete } } });
    await prisma.dailyCheckIn.deleteMany({ where: { userId: { in: usersToDelete } } });
    await prisma.user.deleteMany({ where: { id: { in: usersToDelete } } });
    console.log("Deleted.");
  } else {
    console.log("No users to delete.");
  }
}
run().finally(() => prisma.$disconnect());
