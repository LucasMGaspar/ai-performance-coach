export declare class ProgressionService {
    /**
     * Verifica se o treino atual é um recorde pessoal (PR) e atualiza a tabela se for.
     */
    updatePR(userId: string, exerciseId: string, weightKg: number, reps: number): Promise<boolean>;
    private static toDayStart;
    /**
     * Atualiza o streak do utilizador
     */
    updateStreak(userId: string): Promise<void>;
    /**
     * Calcula e atualiza a pontuação de consistência (0-100)
     */
    updateConsistencyScore(userId: string): Promise<void>;
}
export declare const progressionService: ProgressionService;
//# sourceMappingURL=progression.service.d.ts.map