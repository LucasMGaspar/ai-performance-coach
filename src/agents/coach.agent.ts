// Coach Agent — Análise de histórico de treinos e geração de feedback de progressão
// Fase 1: lógica determinística (Double Progression). Claude entra na Fase 2.

// @ts-ignore — PrismaClient requer `prisma generate` para gerar tipos; ignorar até ao setup da DB
import { prisma } from "../db/client.js";
import { ragService } from "../services/rag.service.js";

// Espelhar o tipo WorkoutLog do schema Prisma localmente
interface WorkoutLog {
  id: string;
  userId: string;
  exerciseId: string;
  date: Date;
  weightKg: number;
  reps: number;
  sets: number;
  rpe: number | null;
  volume: number;
  rawInput: string | null;
}

export interface WorkoutLogData {
  exerciseName: string;
  exerciseId: string;
  weightKg: number;
  reps: number;
  sets: number;
  rpe?: number;
  volume: number;
}

class CoachAgent {
  /**
   * Lógica de Double Progression — pura TypeScript, sem chamada a Claude.
   * Compara o treino actual com o mais recente anterior e sugere progressão.
   */
  private generateProgressionSuggestion(
    logs: WorkoutLog[],
    current: WorkoutLogData
  ): string {
    if (logs.length === 0) {
      return "Primeiro registo deste exercício! Continua assim.";
    }

    const previous = logs[0]; // treino mais recente anterior
    const volumeChange =
      ((current.volume - previous.volume) / previous.volume) * 100;

    let suggestion = "";

    // Feedback de volume
    if (volumeChange > 0) {
      suggestion += `↑ Volume subiu ${volumeChange.toFixed(1)}% vs treino anterior. `;
    } else if (volumeChange < 0) {
      suggestion += `↓ Volume desceu ${Math.abs(volumeChange).toFixed(1)}% vs treino anterior. `;
    }

    // Sugestão de progressão baseada em RPE
    if (current.rpe !== undefined) {
      if (current.rpe <= 7) {
        // Fácil — aumentar carga
        const suggestedWeight = current.weightKg * 1.025; // +2.5%
        suggestion += `RPE ${current.rpe} — podes aumentar para ~${Math.round(suggestedWeight)}kg na próxima sessão.`;
      } else if (current.rpe === 8) {
        // No limite — manter ou +1 rep
        suggestion += `RPE 8 — mantém a carga e tenta +1 rep na próxima sessão.`;
      } else {
        // RPE 9-10 — manter carga, focar execução
        suggestion += `RPE ${current.rpe} — mantém a carga, foca na execução.`;
      }
    }

    return suggestion.trim();
  }

  /**
   * Analisa o treino acabado de registar e retorna feedback de progressão.
   */
  async analyzeWorkout(
    userId: string,
    currentLog: WorkoutLogData
  ): Promise<string> {
    const logs = await ragService.getLast3Workouts(
      userId,
      currentLog.exerciseId
    );

    const progressionSuggestion = this.generateProgressionSuggestion(
      logs,
      currentLog
    );

    return (
      `Registado! ${currentLog.exerciseName}: ${currentLog.weightKg}kg × ${currentLog.reps} × ${currentLog.sets} ` +
      `(volume: ${currentLog.volume}kg)\n${progressionSuggestion}`
    );
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
