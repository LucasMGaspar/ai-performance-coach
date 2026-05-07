// RAG Service — Queries à DB para suportar o Coach Agent
// Fase 1: queries directas sem embeddings (RAG avançado fica para Fase 2)

// @ts-ignore — PrismaClient requer `prisma generate` para gerar tipos; ignorar até ao setup da DB
import { prisma } from "../db/client.js";

// Espelhar os tipos do schema Prisma localmente para evitar dependência de tipos gerados
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

interface DietSummaryToday {
  calories: number;
  protein: number;
  mealsLogged: string[];
}

class RagService {
  /**
   * Busca os últimos 3 WorkoutLog do utilizador para um exercício específico.
   * Ordenado por date DESC, limit 3.
   */
  async getLast3Workouts(
    userId: string,
    exerciseId: string
  ): Promise<WorkoutLog[]> {
    const logs = await prisma.workoutLog.findMany({
      where: { userId, exerciseId },
      orderBy: { date: "desc" },
      take: 3,
      select: {
        id: true,
        userId: true,
        exerciseId: true,
        date: true,
        weightKg: true,
        reps: true,
        sets: true,
        rpe: true,
        volume: true,
        rawInput: true,
      },
    });

    return logs as WorkoutLog[];
  }

  /**
   * Busca todos os DietLog do utilizador de hoje.
   * Soma calories e protein; retorna lista de meal names registados hoje.
   */
  async getDietSummaryToday(userId: string): Promise<DietSummaryToday> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const logs = await prisma.dietLog.findMany({
      where: {
        userId,
        date: { gte: startOfDay },
      },
      select: {
        meal: true,
        calories: true,
        protein: true,
      },
    });

    const calories = logs.reduce(
      (sum: number, log: { calories: number }) => sum + log.calories,
      0
    );
    const protein = logs.reduce(
      (sum: number, log: { protein: number }) => sum + log.protein,
      0
    );
    const mealsLogged = logs.map((log: { meal: string }) => log.meal);

    return { calories, protein, mealsLogged };
  }

  /**
   * Verifica se existe pelo menos 1 WorkoutLog do utilizador hoje.
   */
  async hasWorkoutToday(userId: string): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await prisma.workoutLog.count({
      where: {
        userId,
        date: { gte: startOfDay },
      },
    });

    return count > 0;
  }

  /**
   * Verifica se existe DailyCheckIn do utilizador hoje.
   */
  async hasCheckInToday(userId: string): Promise<boolean> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const count = await prisma.dailyCheckIn.count({
      where: {
        userId,
        date: { gte: startOfDay },
      },
    });

    return count > 0;
  }
}

export const ragService = new RagService();
