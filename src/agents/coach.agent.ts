// Coach Agent — Análise de histórico de treinos e geração de feedback de progressão
// Fase 2: Claude com tool use

// @ts-ignore — PrismaClient requer `prisma generate` para gerar tipos; ignorar até ao setup da DB
import { prisma } from "../db/client.js";
import { ragService } from "../services/rag.service.js";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicClient } from "../lib/anthropic.js";
import { logger } from "../lib/logger.js";

export interface WorkoutLogData {
  exerciseName: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  sets: number;
  rpe?: number;
  volume: number;
}

const COACH_SYSTEM_PROMPT = `Você é um coach de Strength & Conditioning especializado em protocolos de 80 dias. Analise o treino registado e forneça feedback personalizado em português do Brasil.

Processo de raciocínio:
1. Consulte o histórico do exercício (get_exercise_history) para ver progressão
2. Calcule E1RM (compute_e1rm) com os dados actuais para quantificar força
3. Verifique plateau (detect_plateau) se houver histórico suficiente
4. Se RPE alto ou volume baixo, verifique bem-estar recente (get_checkin_history, 3 dias)
5. Se relevante para a progressão, consulte dieta recente (get_diet_summary, 1 dia)

Output:
- 1-3 frases naturais, tom de coach directo
- 1 insight accionável específico (ex: "Na próxima sessão tente 82,5kg" ou "Sono baixo — priorize recuperação antes de aumentar carga")
- Formato WhatsApp: sem markdown, máximo 4 linhas, use emojis com moderação`;

const COACH_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_exercise_history",
    description: "Get the last N workout sessions for a specific exercise for this user",
    input_schema: {
      type: "object" as const,
      properties: {
        exerciseId: { type: "string", description: "Exercise ID" },
        n: { type: "number", description: "Number of past sessions to retrieve (max 10)" },
      },
      required: ["exerciseId", "n"],
    },
  },
  {
    name: "get_diet_summary",
    description: "Get diet summary (calories, protein, meals) for the last N days",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "get_checkin_history",
    description: "Get daily check-in history (mood, sleep quality, energy level) for the last N days",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number", description: "Number of days to look back" },
      },
      required: ["days"],
    },
  },
  {
    name: "compute_e1rm",
    description: "Compute estimated 1-rep max using Epley formula: weight * (1 + reps/30)",
    input_schema: {
      type: "object" as const,
      properties: {
        weightKg: { type: "number", description: "Weight lifted in kg" },
        reps: { type: "number", description: "Number of repetitions" },
      },
      required: ["weightKg", "reps"],
    },
  },
  {
    name: "detect_plateau",
    description: "Detect if athlete is in a plateau: 3+ sessions with no weight or volume progression",
    input_schema: {
      type: "object" as const,
      properties: {
        exerciseId: { type: "string", description: "Exercise ID to check" },
      },
      required: ["exerciseId"],
    },
  },
];

class CoachAgent {
  private async executeTool(
    userId: string,
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    switch (toolName) {
      case "get_exercise_history": {
        const { exerciseId, n } = input as { exerciseId: string; n: number };
        return ragService.getLastNWorkouts(userId, exerciseId, Math.min(n, 10));
      }
      case "get_diet_summary": {
        const { days } = input as { days: number };
        return ragService.getDietSummaryDays(userId, days);
      }
      case "get_checkin_history": {
        const { days } = input as { days: number };
        return ragService.getCheckinHistory(userId, days);
      }
      case "compute_e1rm": {
        const { weightKg, reps } = input as { weightKg: number; reps: number };
        return { e1rm: +(weightKg * (1 + reps / 30)).toFixed(1) };
      }
      case "detect_plateau": {
        const { exerciseId } = input as { exerciseId: string };
        const logs = await ragService.getLastNWorkouts(userId, exerciseId, 5);
        if (logs.length < 3) return { plateau: false, reason: "insufficient_history" };
        const last3 = logs.slice(0, 3);
        const noWeightProgress = last3.every((l) => l.weightKg <= last3[last3.length - 1].weightKg);
        const noVolumeProgress = last3.every((l) => l.volume <= last3[last3.length - 1].volume);
        return {
          plateau: noWeightProgress && noVolumeProgress,
          sessions_checked: last3.length,
          weights: last3.map((l) => l.weightKg),
          volumes: last3.map((l) => l.volume),
        };
      }
      default:
        return { error: `unknown tool: ${toolName}` };
    }
  }

  /**
   * Analisa o treino acabado de registar usando Claude com tool use loop.
   */
  async analyzeWorkout(
    userId: string,
    currentLog: WorkoutLogData
  ): Promise<string> {
    const userMessage = `Treino registado: ${currentLog.exerciseName}, ${currentLog.weightKg}kg × ${currentLog.reps} reps × ${currentLog.sets} séries${currentLog.rpe != null ? `, RPE ${currentLog.rpe}` : ""}. Volume total: ${currentLog.volume}kg. exerciseId=${currentLog.exerciseId}`;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: userMessage },
    ];

    try {
      for (let i = 0; i < 6; i++) {
        const response = await anthropicClient.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 512,
          system: COACH_SYSTEM_PROMPT,
          tools: COACH_TOOLS,
          messages,
        });

        if (response.stop_reason === "end_turn") {
          const textBlock = response.content.find((b) => b.type === "text");
          return textBlock?.type === "text" ? textBlock.text : "Treino registado!";
        }

        if (response.stop_reason === "tool_use") {
          messages.push({ role: "assistant", content: response.content });
          const toolResults: { type: "tool_result"; tool_use_id: string; content: string }[] = [];

          for (const block of response.content) {
            if (block.type !== "tool_use") continue;
            const result = await this.executeTool(userId, block.name, block.input as Record<string, unknown>);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }

          messages.push({ role: "user", content: toolResults });
        }
      }
    } catch (err) {
      logger.error({ err }, "coach agent tool use error");
    }

    return "Treino registado!";
  }

  /**
   * Retorna feedback sobre os macros do dia actual.
   */
  async analyzeDiet(userId: string): Promise<string> {
    const [summary, user] = await Promise.all([
      ragService.getDietSummaryToday(userId),
      prisma.user.findUnique({
        where: { id: userId },
        select: { targetCalories: true, targetProtein: true },
      }) as Promise<{
        targetCalories: number | null;
        targetProtein: number | null;
      } | null>,
    ]);

    const targetCalories = user?.targetCalories ?? 2000;
    const targetProtein = user?.targetProtein ?? 150;

    const mealsText =
      summary.mealsLogged.length > 0
        ? summary.mealsLogged.join(", ")
        : "nenhuma refeição registada";

    return (
      `Hoje: ${Math.round(summary.calories)}kcal / ${Math.round(targetCalories)}kcal | ` +
      `Proteína: ${Math.round(summary.protein)}g / ${Math.round(targetProtein)}g\n` +
      `Refeições: ${mealsText}`
    );
  }

  /**
   * Gera resposta motivacional para check-in registado.
   * Usa frases hard-coded com selecção aleatória.
   */
  async generateMotivationalCheckIn(userName: string | null): Promise<string> {
    const messages = [
      "Check-in registado! Consistência é a chave. 💪",
      "Anotado! Cada dia conta no protocolo. Continua!",
      "Check-in feito! A disciplina de hoje é o resultado de amanhã.",
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    // Personalizar com o nome do utilizador se disponível
    if (userName) {
      return `${userName}, ${message.charAt(0).toLowerCase()}${message.slice(1)}`;
    }

    return message;
  }
}

export const coachAgent = new CoachAgent();
