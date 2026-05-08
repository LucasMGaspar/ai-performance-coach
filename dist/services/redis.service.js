import { Redis } from "@upstash/redis";
import { config } from "../config";
class RedisService {
    redis;
    constructor() {
        this.redis = new Redis({
            url: config.upstashRedisRestUrl,
            token: config.upstashRedisRestToken,
        });
    }
    buildKey(phone) {
        return `session:${phone}`;
    }
    async getSession(phone) {
        const key = this.buildKey(phone);
        const data = await this.redis.get(key);
        if (data === null || data === undefined)
            return null;
        return data;
    }
    async setSession(phone, session) {
        const key = this.buildKey(phone);
        const json = JSON.stringify(session);
        await this.redis.set(key, json, { ex: 1800 });
    }
    async updatePendingContext(phone, ctx) {
        const existing = await this.getSession(phone);
        const session = existing ?? {
            phoneNumber: phone,
            pendingContext: {},
            lastActivity: new Date().toISOString(),
        };
        session.pendingContext = { ...session.pendingContext, ...ctx };
        session.lastActivity = new Date().toISOString();
        await this.setSession(phone, session);
    }
    async updateOnboarding(phone, step, data) {
        const existing = await this.getSession(phone);
        const session = existing ?? {
            phoneNumber: phone,
            pendingContext: {},
            lastActivity: new Date().toISOString(),
        };
        session.onboardingStep = step;
        session.onboardingData = { ...(session.onboardingData ?? {}), ...data };
        session.lastActivity = new Date().toISOString();
        await this.setSession(phone, session);
    }
    async clearSession(phone) {
        const key = this.buildKey(phone);
        await this.redis.del(key);
    }
    buildIdempotencyKey(id) {
        return `msg:idempotency:${id}`;
    }
    async isMessageProcessed(id) {
        const key = this.buildIdempotencyKey(id);
        const val = await this.redis.get(key);
        return val !== null && val !== undefined;
    }
    async setMessageProcessed(id) {
        const key = this.buildIdempotencyKey(id);
        await this.redis.set(key, "1", { ex: 86400 });
    }
}
export const redisService = new RedisService();
//# sourceMappingURL=redis.service.js.map