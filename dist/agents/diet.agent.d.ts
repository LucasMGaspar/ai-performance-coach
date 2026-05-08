declare class DietAgent {
    private client;
    constructor();
    /**
     * Analisa a dieta registada até agora no dia (movido do coachAgent)
     */
    analyzeDietLog(userId: string): Promise<string>;
    /**
     * Responde a perguntas sobre a dieta do utilizador (planeamento e consumo atual)
     */
    answerQuestion(userId: string, question: string): Promise<string>;
}
export declare const dietAgent: DietAgent;
export {};
//# sourceMappingURL=diet.agent.d.ts.map