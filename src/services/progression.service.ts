import { prisma } from "../db/client.js";

export class ProgressionService {
  /**
   * Verifica se o treino atual é um recorde pessoal (PR) e atualiza a tabela se for.
   */
  public async updatePR(userId: string, exerciseId: string, weightKg: number, reps: number) {
    try {
      // @ts-ignore
      const existingPR = await prisma.exercisePR.findUnique({
        where: {
          userId_exerciseId: { userId, exerciseId },
        },
      });

      // Lógica de PR: maior peso. Se pesos iguais, mais repetições.
      const isNewPR = !existingPR || weightKg > existingPR.weightKg || (weightKg === existingPR.weightKg && reps > existingPR.reps);

      if (isNewPR) {
        // @ts-ignore
        await prisma.exercisePR.upsert({
          where: {
            userId_exerciseId: { userId, exerciseId },
          },
          update: {
            weightKg,
            reps,
            date: new Date(),
          },
          create: {
            userId,
            exerciseId,
            weightKg,
            reps,
            date: new Date(),
          },
        });
        return true; // Novo PR detectado!
      }
      return false;
    } catch (error) {
      console.error("[ProgressionService] Error updating PR:", error);
      return false;
    }
  }

  private static toDayStart(d: Date): Date {
    return new Date(d.toISOString().split("T")[0] + "T00:00:00.000Z");
  }

  /**
   * Atualiza o streak do utilizador
   */
  public async updateStreak(userId: string) {
    try {
      // @ts-ignore
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return;

      const now = new Date();
      const lastLog = user.lastLogAt;

      let newStreak = user.streakCount;

      if (!lastLog) {
        newStreak = 1;
      } else {
        const todayStart = ProgressionService.toDayStart(now);
        const lastLogStart = ProgressionService.toDayStart(lastLog);
        const diffInDays = Math.round((todayStart.getTime() - lastLogStart.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffInDays === 1) {
          // Consecutivo
          newStreak += 1;
        } else if (diffInDays > 1) {
          // Quebrou o streak
          newStreak = 1;
        }
        // Se diffInDays === 0, já logou hoje, manter o streak
      }

      // @ts-ignore
      await prisma.user.update({
        where: { id: userId },
        data: {
          streakCount: newStreak,
          maxStreak: Math.max(newStreak, user.maxStreak),
          lastLogAt: now,
        },
      });

      // Recalcular Score de Consistência
      await this.updateConsistencyScore(userId);
    } catch (error) {
      console.error("[ProgressionService] Error updating streak:", error);
    }
  }

  /**
   * Calcula e atualiza a pontuação de consistência (0-100)
   */
  public async updateConsistencyScore(userId: string) {
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // @ts-ignore
      const [user, dietLogs, workoutLogs] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.dietLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } } }),
        prisma.workoutLog.findMany({ where: { userId, date: { gte: sevenDaysAgo } } }),
      ]);

      if (!user) return;

      const targetCal = user.targetCalories || 2000;
      
      // Agrupar dieta por dia
      const dietByDay = new Map<string, number>();
      dietLogs.forEach(log => {
        const day = log.date.toISOString().split('T')[0];
        dietByDay.set(day, (dietByDay.get(day) || 0) + log.calories);
      });

      // Contar dias de treino únicos
      const workoutDays = new Set(workoutLogs.map(l => l.date.toISOString().split('T')[0]));

      let dietPoints = 0;
      dietByDay.forEach(totalCal => {
        // Ponto se as calorias estiverem num range aceitável (+/- 15%)
        const diff = Math.abs(totalCal - targetCal) / targetCal;
        if (diff <= 0.15) dietPoints++;
      });

      // Score: 50% Dieta (baseado em 7 dias) + 50% Treino (baseado em meta de 4 dias/semana)
      const dietScore = (dietPoints / 7) * 50;
      const workoutScore = Math.min((workoutDays.size / 4) * 50, 50);

      const totalScore = Math.round(dietScore + workoutScore);

      // @ts-ignore
      await prisma.user.update({
        where: { id: userId },
        data: { consistencyScore: totalScore }
      });
    } catch (error) {
      console.error("[ProgressionService] Error updating consistency score:", error);
    }
  }
}

export const progressionService = new ProgressionService();
