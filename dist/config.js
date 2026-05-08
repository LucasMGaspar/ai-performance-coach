import { z } from "zod";
import "dotenv/config";
const envSchema = z.object({
    DATABASE_URL: z.string().min(1),
    DIRECT_URL: z.string().min(1),
    ANTHROPIC_API_KEY: z.string().min(1),
    GROQ_API_KEY: z.string().min(1),
    WAPI_TOKEN: z.string().min(1),
    WAPI_INSTANCE_ID: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().min(1),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    WEBHOOK_SECRET: z.string().min(1),
    NUDGE_SECRET: z.string().min(1),
    DASHBOARD_URL: z.string().default("http://localhost:3000"),
    PORT: z.string().default("3000"),
    NODE_ENV: z.string().default("development"),
    LANGFUSE_PUBLIC_KEY: z.string().optional(),
    LANGFUSE_SECRET_KEY: z.string().optional(),
    LANGFUSE_HOST: z.string().optional(),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error("Variaveis de ambiente invalidas ou em falta:\n", parsed.error.flatten().fieldErrors);
    process.exit(1);
}
const env = parsed.data;
export const config = {
    databaseUrl: env.DATABASE_URL,
    directUrl: env.DIRECT_URL,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    groqApiKey: env.GROQ_API_KEY,
    wapiToken: env.WAPI_TOKEN,
    wapiInstanceId: env.WAPI_INSTANCE_ID,
    upstashRedisRestUrl: env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: env.UPSTASH_REDIS_REST_TOKEN,
    webhookSecret: env.WEBHOOK_SECRET,
    nudgeSecret: env.NUDGE_SECRET,
    dashboardUrl: env.DASHBOARD_URL,
    port: parseInt(env.PORT, 10),
    nodeEnv: env.NODE_ENV,
    langfusePublicKey: env.LANGFUSE_PUBLIC_KEY,
    langfuseSecretKey: env.LANGFUSE_SECRET_KEY,
    langfuseHost: env.LANGFUSE_HOST,
};
//# sourceMappingURL=config.js.map