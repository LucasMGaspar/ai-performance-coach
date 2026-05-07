import "dotenv/config";
import { execSync } from "child_process";

const result = execSync(
  `npx tsx -e "import {prisma} from './src/db/client.ts'; prisma.user.findMany({select:{id:true,name:true,phoneNumber:true,onboarded:true}}).then(u=>{console.table(u);process.exit(0)})"`,
  { cwd: process.cwd(), encoding: "utf-8" }
);
console.log(result);
