// Nudge Agent — verifica se o utilizador registou actividade hoje e envia lembrete proactivo

// @ts-ignore — PrismaClient requer `prisma generate` para gerar tipos; ignorar até ao setup da DB
import { prisma } from "../db/client.js";
import { logger } from "../lib/logger";
import { toDayStart } from "../services/progression.service.js";
import { ragService } from "../services/rag.service.js";
import { wapiService } from "../services/wapi.service.js";
import type { NudgeType } from "../types/index.js";

// ---------------------------------------------------------------------------
// Mensagens motivacionais
// ---------------------------------------------------------------------------

function dietNudgeMessage(mealLabel: string): string {
  return `Ei! Ainda não registrei o seu ${mealLabel}. Não esqueça de registrar o que você comeu para manter os macros no caminho certo! 🥗`;
}

function workoutNudgeMessage(): string {
  const messages = [
    "Treino de hoje ainda não registado! Faltam poucos dias para os 80. Vai lá! 💪",
    "Hey! Não vi registo de treino hoje. Dia de descanso ou esqueceste de registar?",
    "O protocolo continua! Lembra-te de registar o treino de hoje. 🏋️",
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

function checkInNudgeMessage(): string {
  return "Check-in do dia ainda em falta! Manda-me como estás — humor, sono e energia (ex: 'hoje: humor 8, sono 7, energia 9'). 📊";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function checkMealToday(
  userId: string,
  mealLabel: string
): Promise<boolean> {
  const startOfDay = toDayStart(new Date());

  const count = await prisma.dietLog.count({
    where: {
      userId,
      date: { gte: startOfDay },
      meal: { contains: mealLabel, mode: "insensitive" },
    },
  });

  return count > 0;
}

// ---------------------------------------------------------------------------
// NudgeAgent
// ---------------------------------------------------------------------------

class NudgeAgent {
  /**
   * Verifica se o utilizador registou a actividade do tipo indicado hoje.
   * Se não registou, envia uma mensagem de lembrete via WhatsApp.
   *
   * @returns true se enviou nudge, false caso contrário
   */
  async checkAndNudge(
    userId: string,
    phoneNumber: string,
    nudgeType: NudgeType,
    mealLabel?: string
  ): Promise<boolean> {
    switch (nudgeType) {
      case "diet": {
        const label = mealLabel ?? "Lanche";
        const hasMeal = await checkMealToday(userId, label);
        if (!hasMeal) {
          await wapiService.sendTextMessage(phoneNumber, dietNudgeMessage(label));
          return true;
        }
        return false;
      }

      case "workout": {
        const hasWorkout = await ragService.hasWorkoutToday(userId);
        if (!hasWorkout) {
          await wapiService.sendTextMessage(phoneNumber, workoutNudgeMessage());
          return true;
        }
        return false;
      }

      case "checkin": {
        const hasCheckIn = await ragService.hasCheckInToday(userId);
        if (!hasCheckIn) {
          await wapiService.sendTextMessage(phoneNumber, checkInNudgeMessage());
          return true;
        }
        return false;
      }

      default: {
        // Exhaustive check — TypeScript garante que nudgeType é coberto acima
        const _exhaustive: never = nudgeType;
        logger.error({ nudgeType: _exhaustive }, "nudgeAgent: nudgeType desconhecido");
        return false;
      }
    }
  }
}

export const nudgeAgent = new NudgeAgent();
