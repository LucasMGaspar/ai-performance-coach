import { Redis } from "@upstash/redis";
import { config } from "../config";

export interface ConversationSession {
  phoneNumber: string;
  pendingContext: {
    lastExerciseName?: string;
    lastEquipment?: string;
    lastBarWeightKg?: number;
  };
  lastActivity: string; // ISO string — Redis serializa como JSON
}

class RedisService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      url: config.upstashRedisRestUrl,
      token: config.upstashRedisRestToken,
    });
  }

  private buildKey(phone: string): string {
    return `session:${phone}`;
  }

  async getSession(phone: string): Promise<ConversationSession | null> {
    const key = this.buildKey(phone);
    const data = await this.redis.get(key);
    if (data === null || data === undefined) return null;
    return data as ConversationSession;
  }

  async setSession(phone: string, session: ConversationSession): Promise<void> {
    const key = this.buildKey(phone);
    const json = JSON.stringify(session);
    await this.redis.set(key, json, { ex: 1800 });
  }

  async updatePendingContext(
    phone: string,
    ctx: ConversationSession["pendingContext"]
  ): Promise<void> {
    const existing = await this.getSession(phone);
    const session: ConversationSession = existing ?? {
      phoneNumber: phone,
      pendingContext: {},
      lastActivity: new Date().toISOString(),
    };

    session.pendingContext = { ...session.pendingContext, ...ctx };
    session.lastActivity = new Date().toISOString();

    await this.setSession(phone, session);
  }

  async clearSession(phone: string): Promise<void> {
    const key = this.buildKey(phone);
    await this.redis.del(key);
  }
}

export const redisService = new RedisService();
