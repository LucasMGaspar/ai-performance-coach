import type { NudgeType } from "../types/index.js";
declare class NudgeAgent {
    /**
     * Verifica se o utilizador registou a actividade do tipo indicado hoje.
     * Se não registou, envia uma mensagem de lembrete via WhatsApp.
     *
     * @returns true se enviou nudge, false caso contrário
     */
    checkAndNudge(userId: string, phoneNumber: string, nudgeType: NudgeType, mealLabel?: string): Promise<boolean>;
}
export declare const nudgeAgent: NudgeAgent;
export {};
//# sourceMappingURL=nudge.agent.d.ts.map