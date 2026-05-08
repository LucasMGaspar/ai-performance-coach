import { anthropicClient } from "../lib/anthropic";
import { prisma } from "../db/client";
import { logger } from "../lib/logger";
import { parseExtraction, } from "../schemas/extraction.schema";
// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------
const EXTRACTION_TOOL = {
    name: "extract_message",
    description: "Extrai dados estruturados de treino, dieta, check-in ou pergunta da mensagem do utilizador.",
    input_schema: {
        type: "object",
        properties: {
            type: {
                type: "string",
                enum: ["workout", "diet", "checkin", "question", "unknown"],
                description: "Tipo de mensagem detectado",
            },
            exercises: {
                type: "array",
                description: "Lista de exercícios (apenas para type=workout)",
                items: {
                    type: "object",
                    properties: {
                        exerciseName: { type: "string" },
                        weightPerSide: { type: "number", description: "Kg de cada lado (quando user diz 'X de cada lado')" },
                        totalWeight: { type: "number", description: "Peso total em kg" },
                        reps: { type: "integer" },
                        sets: { type: "integer" },
                        rpe: { type: "number", description: "Rate of Perceived Exertion 1-10" },
                    },
                    required: ["exerciseName", "reps", "sets"],
                },
            },
            meal: { type: "string", description: "Nome da refeição (apenas para type=diet)" },
            calories: { type: "number" },
            protein: { type: "number", description: "Proteína em gramas" },
            carbs: { type: "number", description: "Hidratos em gramas" },
            fat: { type: "number", description: "Gordura em gramas" },
            description: { type: "string", description: "Descrição livre da refeição" },
            mood: { type: "integer", description: "Humor 1-10 (apenas para type=checkin)" },
            sleepQuality: { type: "integer", description: "Qualidade do sono 1-10" },
            energyLevel: { type: "integer", description: "Nível de energia 1-10" },
            notes: { type: "string", description: "Notas livres do check-in" },
            question: { type: "string", description: "Pergunta do utilizador (apenas para type=question)" },
            message: { type: "string", description: "Resposta útil em português (apenas para type=unknown)" },
        },
        required: ["type"],
    },
};
const STATIC_SYSTEM_PROMPT = `Você é um assistente de extracção de dados de treino e dieta. Analise a mensagem do utilizador e use a ferramenta extract_message para extrair as informações estruturadas.

REGRA CRÍTICA — PESO "DE CADA LADO":
- Se o utilizador disser "Xkg de cada lado", "X de cada lado", "X por lado" — preencher weightPerSide com X
- NÃO calcular totalWeight — deixar null (será calculado pelo sistema)
- Se disser o peso total directamente (ex: "90kg no supino") — preencher totalWeight directamente

CATÁLOGO DE EXERCÍCIOS:
O catálogo abaixo contém os exercícios disponíveis com seus aliases. Use-o para normalizar o nome do exercício.

REGRAS:
- O campo "exercises" é SEMPRE um array (mesmo com 1 exercício)
- Se o utilizador mencionar uma refeição das suas refeições planeadas (ex: "jantei"), utilize os macros planeados para preencher os campos de Dieta
- Se o utilizador fizer uma pergunta sobre o seu plano de treino, dieta, ou macros (ex: "qual a minha dieta?"), use type="question" com a pergunta
- O campo "message" em type="unknown" é OBRIGATÓRIO e deve conter uma resposta útil ao utilizador em português`;
// ---------------------------------------------------------------------------
// ParserAgent
// ---------------------------------------------------------------------------
export class ParserAgent {
    client;
    /** Cache em memória do catálogo de exercícios */
    catalogCache = null;
    catalogCacheTime = 0;
    CACHE_TTL = 3_600_000; // 1 hora em ms
    constructor() {
        this.client = anthropicClient;
    }
    // -------------------------------------------------------------------------
    // Métodos privados
    // -------------------------------------------------------------------------
    /** Busca o catálogo da DB ou devolve cache se ainda válido */
    async getExerciseCatalog() {
        const now = Date.now();
        if (this.catalogCache && now - this.catalogCacheTime < this.CACHE_TTL) {
            return this.catalogCache;
        }
        // @ts-ignore — requer `prisma generate` com DB migrada
        const catalog = await prisma.exerciseCatalog.findMany();
        this.catalogCache = catalog;
        this.catalogCacheTime = now;
        return this.catalogCache;
    }
    /** Busca perfil do utilizador na DB */
    async getUserProfile(userId) {
        // @ts-ignore — requer `prisma generate` com DB migrada
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                targetCalories: true,
                targetProtein: true,
            },
        });
        return user;
    }
    /** Busca as refeições planeadas do utilizador */
    async getScheduledMeals(userId) {
        // @ts-ignore
        return await prisma.scheduledMeal.findMany({
            where: { userId },
            select: { mealName: true, description: true, targetCalories: true, targetProtein: true, targetCarbs: true, targetFat: true }
        });
    }
    /**
     * Aplica a regra de negócio "de cada lado":
     * Converte weightPerSide em totalWeight usando o catálogo de exercícios.
     */
    applyWeightPerSideRule(result, catalog) {
        if (result.type !== "workout")
            return result;
        const exercises = result.exercises.map((exercise) => {
            if (exercise.weightPerSide == null)
                return exercise;
            const weightPerSide = exercise.weightPerSide;
            const nameLower = exercise.exerciseName.toLowerCase();
            // Encontrar no catálogo por nome canónico ou aliases (lowercase includes)
            const catalogEntry = catalog.find((entry) => {
                const entryNameLower = entry.name.toLowerCase();
                if (entryNameLower.includes(nameLower) || nameLower.includes(entryNameLower)) {
                    return true;
                }
                // Verificar aliases
                return entry.aliases.some((alias) => {
                    const aliasLower = alias.toLowerCase();
                    return aliasLower.includes(nameLower) || nameLower.includes(aliasLower);
                });
            });
            let totalWeight;
            if (catalogEntry?.barWeightKg != null) {
                // Encontrado com barra: peso total = (pesoLado * 2) + pesoBarra
                totalWeight = weightPerSide * 2 + catalogEntry.barWeightKg;
            }
            else {
                // Não encontrado ou sem barra: totalWeight = pesoLado * 2
                totalWeight = weightPerSide * 2;
            }
            // Remover weightPerSide (campo interno) e definir totalWeight calculado
            const { weightPerSide: _removed, ...rest } = exercise;
            return { ...rest, totalWeight };
        });
        return { ...result, exercises };
    }
    // -------------------------------------------------------------------------
    // API pública
    // -------------------------------------------------------------------------
    /**
     * Processa texto livre (transcrição de áudio ou mensagem directa)
     * e devolve dados estruturados de treino/dieta/check-in.
     */
    async parseMessage(text, userId, _phone) {
        // 1. Buscar catálogo (cache ou DB)
        const exerciseCatalog = await this.getExerciseCatalog();
        // 2. Buscar perfil do utilizador e refeições planeadas
        const [userProfile, scheduledMeals] = await Promise.all([
            this.getUserProfile(userId),
            this.getScheduledMeals(userId)
        ]);
        // 3. Construir system messages com prompt caching
        const systemMessages = [
            {
                type: "text",
                text: STATIC_SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" }, // instruções fixas — CACHE
            },
            {
                type: "text",
                text: JSON.stringify(exerciseCatalog), // catálogo — CACHE (muda raramente)
                cache_control: { type: "ephemeral" },
            },
            {
                type: "text",
                text: `Perfil do utilizador: ${JSON.stringify(userProfile)}\nRefeições planeadas: ${JSON.stringify(scheduledMeals)}`, // sem cache
            },
        ];
        // 4. Chamar Claude com tool use
        try {
            const response = await this.client.messages.create({
                model: "claude-sonnet-4-5",
                max_tokens: 1024,
                system: systemMessages,
                tools: [EXTRACTION_TOOL],
                tool_choice: { type: "tool", name: "extract_message" },
                messages: [
                    {
                        role: "user",
                        content: text,
                    },
                ],
            });
            // tool_choice força tool_use — input já é objecto JS validado pelo SDK
            const toolBlock = response.content.find((b) => b.type === "tool_use");
            if (!toolBlock || toolBlock.type !== "tool_use") {
                throw new Error("Resposta inesperada: nenhum bloco tool_use encontrado");
            }
            // Validação com Zod para type safety TypeScript
            const parsed = parseExtraction(toolBlock.input);
            // 5. Aplicar regra de negócio "de cada lado"
            return this.applyWeightPerSideRule(parsed, exerciseCatalog);
        }
        catch (err) {
            // Erro de rede, schema inválido ou tool_use ausente — devolver resposta segura
            logger.error({ err }, "parser.agent: erro ao processar mensagem");
            return {
                type: "unknown",
                message: "Não consegui processar a mensagem. Tenta de novo!",
            };
        }
    }
}
// Instância singleton exportada para uso nos handlers
export const parserAgent = new ParserAgent();
//# sourceMappingURL=parser.agent.js.map