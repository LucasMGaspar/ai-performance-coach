export interface WorkoutLogData {
    exerciseName: string;
    exerciseId: string;
    weightKg: number;
    reps: number;
    sets: number;
    rpe?: number;
    volume: number;
}
declare class CoachAgent {
    /**
     * Lógica de Double Progression — pura TypeScript, sem chamada a Claude.
     * Compara o treino actual com o mais recente anterior e sugere progressão.
     */
    private generateProgressionSuggestion;
    /**
     * Analisa o treino acabado de registar e retorna feedback de progressão.
     */
    analyzeWorkout(userId: string, currentLog: WorkoutLogData): Promise<string>;
    /**
     * Retorna feedback sobre os macros do dia actual.
     */
    analyzeDiet(userId: string): Promise<string>;
    /**
     * Gera resposta motivacional para check-in registado.
     * Usa frases hard-coded com selecção aleatória.
     */
    generateMotivationalCheckIn(userName: string | null): Promise<string>;
}
export declare const coachAgent: CoachAgent;
export {};
//# sourceMappingURL=coach.agent.d.ts.map