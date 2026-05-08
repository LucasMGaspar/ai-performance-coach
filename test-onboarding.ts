import { onboardingAgent } from './src/agents/onboarding.agent.ts';
import { redisService } from './src/services/redis.service.ts';
import { prisma } from './src/db/client.ts';

async function run() {
  await redisService.updateOnboarding('5527997563869', 'profile', {});
  const res = await onboardingAgent.handle('cmow3xrb60001wgtzhhifsjaz', '5527997563869', 'Daniel, 27 anos, masculino, 110kg, 178cm');
  console.log(res);
  await prisma.$disconnect();
  process.exit(0);
}
run().catch(console.error);
