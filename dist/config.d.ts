import "dotenv/config";
export declare const config: {
    readonly databaseUrl: string;
    readonly directUrl: string;
    readonly anthropicApiKey: string;
    readonly groqApiKey: string;
    readonly wapiToken: string;
    readonly wapiInstanceId: string;
    readonly upstashRedisRestUrl: string;
    readonly upstashRedisRestToken: string;
    readonly webhookSecret: string;
    readonly nudgeSecret: string;
    readonly dashboardUrl: string;
    readonly port: number;
    readonly nodeEnv: string;
    readonly langfusePublicKey: string | undefined;
    readonly langfuseSecretKey: string | undefined;
    readonly langfuseHost: string | undefined;
};
export type Config = typeof config;
//# sourceMappingURL=config.d.ts.map