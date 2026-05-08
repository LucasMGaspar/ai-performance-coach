import type { OnboardingStep, OnboardingData } from "../types";
export interface ConversationSession {
    phoneNumber: string;
    pendingContext: {
        lastExerciseName?: string;
        lastEquipment?: string;
        lastBarWeightKg?: number;
    };
    lastActivity: string;
    onboardingStep?: OnboardingStep;
    onboardingData?: OnboardingData;
}
declare class RedisService {
    private redis;
    constructor();
    private buildKey;
    getSession(phone: string): Promise<ConversationSession | null>;
    setSession(phone: string, session: ConversationSession): Promise<void>;
    updatePendingContext(phone: string, ctx: ConversationSession["pendingContext"]): Promise<void>;
    updateOnboarding(phone: string, step: OnboardingStep, data: Partial<OnboardingData>): Promise<void>;
    clearSession(phone: string): Promise<void>;
    private buildIdempotencyKey;
    isMessageProcessed(id: string): Promise<boolean>;
    setMessageProcessed(id: string): Promise<void>;
}
export declare const redisService: RedisService;
export {};
//# sourceMappingURL=redis.service.d.ts.map