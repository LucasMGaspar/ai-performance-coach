import { Redis } from "@upstash/redis";
import { config } from "../config";
import type { OnboardingStep, OnboardingData } from "../types";

export interface ConversationSession {
  phoneNumber: string;
  pendingContext: {
    lastExerciseName?: string;
    lastEquipment?: string;
    lastBarWeightKg?: number;
  };
  lastActivity: string; // ISO string — Redis serializa como JSON
  onboardingStep?: OnboardingStep;
  onboardingData?: OnboardingData;
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

  async updateOnboarding(
    phone: string,
    step: OnboardingStep,
    data: Partial<OnboardingData>
  ): Promise<void> {
    const existing = await this.getSession(phone);
    const session: ConversationSession = existing ?? {
      phoneNumber: phone,
      pendingContext: {},
      lastActivity: new Date().toISOString(),
    };

    session.onboardingStep = step;
    session.onboardingData = { ...(session.onboardingData ?? {}), ...data };
    session.lastActivity = new Date().toISOString();

    await this.setSession(phone, session);
  }

  async clearSession(phone: string): Promise<void> {
    const key = this.buildKey(phone);
    await this.redis.del(key);
  }

  private buildIdempotencyKey(id: string): string {
    return `msg:idempotency:${id}`;
  }

  async isMessageProcessed(id: string): Promise<boolean> {
    const key = this.buildIdempotencyKey(id);
    const val = await this.redis.get(key);
    return val !== null && val !== undefined;
  }

  async setMessageProcessed(id: string): Promise<void> {
    const key = this.buildIdempotencyKey(id);
    await this.redis.set(key, "1", { ex: 86400 });
  }
}

export const redisService = new RedisService();
