import { type ExtractionResult } from "../schemas/extraction.schema";
export declare class ParserAgent {
    private client;
    /** Cache em memória do catálogo de exercícios */
    private catalogCache;
    private catalogCacheTime;
    private readonly CACHE_TTL;
    constructor();
    /** Busca o catálogo da DB ou devolve cache se ainda válido */
    private getExerciseCatalog;
    /** Busca perfil do utilizador na DB */
    private getUserProfile;
    /** Busca as refeições planeadas do utilizador */
    private getScheduledMeals;
    /**
     * Aplica a regra de negócio "de cada lado":
     * Converte weightPerSide em totalWeight usando o catálogo de exercícios.
     */
    private applyWeightPerSideRule;
    /**
     * Processa texto livre (transcrição de áudio ou mensagem directa)
     * e devolve dados estruturados de treino/dieta/check-in.
     */
    parseMessage(text: string, userId: string, _phone: string): Promise<ExtractionResult>;
}
export declare const parserAgent: ParserAgent;
//# sourceMappingURL=parser.agent.d.ts.map