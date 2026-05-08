import Anthropic from "@anthropic-ai/sdk";
// @ts-ignore — requer `npx prisma generate` após setup da DB para gerar tipos correctos
import type { ExerciseCatalog, User } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../db/client";
import {
  parseExtraction,
  type ExtractionResult,
} from "../schemas/extraction.schema";

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const STATIC_SYSTEM_PROMPT = `Você é um assistente de extracção de dados de treino e dieta. Analise a mensagem do utilizador e extraia as informações em formato JSON estruturado.

REGRA CRÍTICA — PESO "DE CADA LADO":
- Se o utilizador disser "Xkg de cada lado", "X de cada lado", "X por lado" — preencher weightPerSide com X
- NÃO calcular totalWeight — deixar null (será calculado pelo sistema)
- Se disser o peso total directamente (ex: "90kg no supino") — preencher totalWeight directamente

CATÁLOGO DE EXERCÍCIOS:
O catálogo abaixo contém os exercícios disponíveis com seus aliases. Use-o para normalizar o nome do exercício.

SCHEMAS OBRIGATÓRIOS — use EXACTAMENTE estes campos e nomes:

Treino:
{"type":"workout","exercises":[{"exerciseName":"string","totalWeight":number,"reps":number,"sets":number,"rpe":number_opcional}]}

Dieta:
{"type":"diet","meal":"string","calories":number_opcional,"protein":number_opcional,"carbs":number_opcional,"fat":number_opcional,"description":"string_opcional"}

Check-in:
{"type":"checkin","mood":number_1_10_opcional,"sleepQuality":number_1_10_opcional,"energyLevel":number_1_10_opcional,"notes":"string_opcional"}

Pergunta:
{"type":"question","question":"string"}

Mensagem não reconhecida:
{"type":"unknown","message":"resposta útil em português"}

REGRAS:
- Responda APENAS com JSON válido, sem markdown, sem explicações
- O campo "exercises" é SEMPRE um array (mesmo com 1 exercício)
- Se o utilizador mencionar uma refeição das suas refeições planeadas (ex: "jantei"), utilize os macros planeados para preencher o JSON de Dieta.
- Se o utilizador fizer uma pergunta sobre o seu plano de treino, dieta, ou macros (ex: "qual a minha dieta?"), extraia como "question" contendo a pergunta.
- O campo "message" em unknown é OBRIGATÓRIO e deve conter uma resposta útil ao utilizador`;

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

type UserProfile = Pick<User, "id" | "name" | "targetCalories" | "targetProtein">;

// ---------------------------------------------------------------------------
// ParserAgent
// ---------------------------------------------------------------------------

export class ParserAgent {
  private client: Anthropic;

  /** Cache em memória do catálogo de exercícios */
  private catalogCache: ExerciseCatalog[] | null = null;
  private catalogCacheTime: number = 0;
  private readonly CACHE_TTL = 3_600_000; // 1 hora em ms

  constructor() {
    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });
  }

  // -------------------------------------------------------------------------
  // Métodos privados
  // -------------------------------------------------------------------------

  /** Busca o catálogo da DB ou devolve cache se ainda válido */
  private async getExerciseCatalog(): Promise<ExerciseCatalog[]> {
    const now = Date.now();
    if (this.catalogCache && now - this.catalogCacheTime < this.CACHE_TTL) {
      return this.catalogCache;
    }

    // @ts-ignore — requer `prisma generate` com DB migrada
    const catalog = await prisma.exerciseCatalog.findMany();
    this.catalogCache = catalog as ExerciseCatalog[];
    this.catalogCacheTime = now;
    return this.catalogCache;
  }

  /** Busca perfil do utilizador na DB */
  private async getUserProfile(userId: string): Promise<UserProfile | null> {
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
    return user as UserProfile | null;
  }

  /** Busca as refeições planeadas do utilizador */
  private async getScheduledMeals(userId: string) {
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
  private applyWeightPerSideRule(
    result: ExtractionResult,
    catalog: ExerciseCatalog[]
  ): ExtractionResult {
    if (result.type !== "workout") return result;

    const exercises = result.exercises.map((exercise) => {
      if (exercise.weightPerSide == null) return exercise;

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

      let totalWeight: number;
      if (catalogEntry?.barWeightKg != null) {
        // Encontrado com barra: peso total = (pesoLado * 2) + pesoBarra
        totalWeight = weightPerSide * 2 + catalogEntry.barWeightKg;
      } else {
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
  async parseMessage(
    text: string,
    userId: string,
    _phone: string
  ): Promise<ExtractionResult> {
    // 1. Buscar catálogo (cache ou DB)
    const exerciseCatalog = await this.getExerciseCatalog();

    // 2. Buscar perfil do utilizador e refeições planeadas
    const [userProfile, scheduledMeals] = await Promise.all([
      this.getUserProfile(userId),
      this.getScheduledMeals(userId)
    ]);

    // 3. Construir system messages com prompt caching
    const systemMessages: Anthropic.TextBlockParam[] = [
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

    // 4. Chamar Claude com structured output manual (SDK ainda não suporta Zod nativo)
    try {
      const response = await this.client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1024,
        system: systemMessages,
        messages: [
          {
            role: "user",
            content: `${text}\n\nResponda APENAS com JSON válido.`,
          },
        ],
      });

      const rawText =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Strip de markdown code blocks que o Claude por vezes adiciona (```json ... ```)
      const cleaned = rawText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");

      // Parse e validação com Zod
      const parsed = parseExtraction(JSON.parse(cleaned));

      // 5. Aplicar regra de negócio "de cada lado"
      return this.applyWeightPerSideRule(parsed, exerciseCatalog);
    } catch (err) {
      // JSON inválido ou schema não validado — devolver resposta segura
      console.error("parser.agent: erro ao processar mensagem —", err);
      return {
        type: "unknown",
        message: "Não consegui processar a mensagem. Tenta de novo!",
      };
    }
  }
}

// Instância singleton exportada para uso nos handlers
export const parserAgent = new ParserAgent();
