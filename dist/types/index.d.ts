export type NudgeType = "diet" | "workout" | "checkin";
export interface ScheduledMealData {
    mealName: string;
    scheduledTime: string;
    description: string;
    targetCalories: number;
    targetProtein: number;
    targetCarbs?: number;
    targetFat?: number;
}
export interface OnboardingData {
    name?: string;
    age?: number;
    sex?: "masculino" | "feminino";
    weightKg?: number;
    heightCm?: number;
    experienceLevel?: "iniciante" | "intermédio" | "avançado";
    goal?: string;
    targetCalories?: number;
    targetProtein?: number;
    mealsRaw?: string;
    meals?: ScheduledMealData[];
}
export type OnboardingStep = "welcome" | "profile" | "experience_goal" | "calories_confirm" | "meals" | "meals_confirm" | "complete";
export interface WApiMessagePayload {
    event: string;
    messageId?: string;
    instanceId: string;
    connectedPhone: string;
    fromMe: boolean;
    sender: {
        id: string;
        pushName?: string;
    };
    msgContent: {
        conversation?: string;
        audioMessage?: {
            URL: string;
            mediaKey: string;
            mimetype?: string;
            seconds?: number;
            PTT?: boolean;
        };
        imageMessage?: {
            url: string;
            mimetype?: string;
            caption?: string;
        };
    };
}
//# sourceMappingURL=index.d.ts.map