import { prisma } from "./prisma";

function startOfDayUTC() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function getUserDashboard(userId: string) {
  const today = startOfDayUTC();

  const [user, workoutLogsToday, dietLogsToday, allWorkoutLogs, checkIns, consistencyRaw] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),

      prisma.workoutLog.findMany({
        where: { userId, date: { gte: today } },
        include: { exercise: true },
        orderBy: { date: "asc" },
      }),

      prisma.dietLog.findMany({
        where: { userId, date: { gte: today } },
        orderBy: { date: "asc" },
      }),

      prisma.workoutLog.findMany({
        where: { userId },
        include: { exercise: true },
        orderBy: { date: "desc" },
        take: 200,
      }),

      prisma.dailyCheckIn.findMany({
        where: { userId },
        orderBy: { date: "desc" },
        take: 30,
      }),

      // Últimos 84 dias para o heatmap
      Promise.all([
        prisma.workoutLog.findMany({
          where: { userId, date: { gte: new Date(Date.now() - 84 * 86400000) } },
          select: { date: true },
        }),
        prisma.dietLog.findMany({
          where: { userId, date: { gte: new Date(Date.now() - 84 * 86400000) } },
          select: { date: true },
        }),
      ]),
    ]);

  // Dia do protocolo (usando createdAt como dia 1)
  const msPerDay = 86400000;
  const protocolDay = Math.min(
    80,
    Math.max(1, Math.floor((Date.now() - user.createdAt.getTime()) / msPerDay) + 1)
  );

  // Macros de hoje
  const macrosToday = dietLogsToday.reduce(
    (acc, log) => ({
      calories: acc.calories + (log.calories ?? 0),
      protein: acc.protein + (log.protein ?? 0),
      carbs: acc.carbs + (log.carbs ?? 0),
      fat: acc.fat + (log.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  // Heatmap — agrupar por dia (YYYY-MM-DD)
  const [workoutDays, dietDays] = consistencyRaw;
  const workoutSet = new Set(workoutDays.map((r: any) => r.date.toISOString().slice(0, 10)));
  const dietSet = new Set(dietDays.map((r: any) => r.date.toISOString().slice(0, 10)));

  const heatmapDays: Array<{ date: string; type: "both" | "workout" | "diet" | "none" }> = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date(Date.now() - i * msPerDay);
    const key = d.toISOString().slice(0, 10);
    const hasW = workoutSet.has(key);
    const hasD = dietSet.has(key);
    heatmapDays.push({
      date: key,
      type: hasW && hasD ? "both" : hasW ? "workout" : hasD ? "diet" : "none",
    });
  }

  // Tonelagem de hoje
  const tonnageToday = workoutLogsToday.reduce(
    (acc, l) => acc + l.weightKg * l.reps * l.sets,
    0
  );

  // Progressão por exercício (últimas 10 sessões de cada)
  const progressionMap = new Map<string, { name: string; data: { date: string; weight: number; volume: number }[] }>();
  for (const log of allWorkoutLogs) {
    const name = log.exercise.name;
    if (!progressionMap.has(name)) progressionMap.set(name, { name, data: [] });
    const entry = progressionMap.get(name)!;
    if (entry.data.length < 15) {
      entry.data.unshift({ date: log.date.toISOString().slice(0, 10), weight: log.weightKg, volume: log.volume });
    }
  }

  // Sessão anterior por exercício (para comparação na ficha do dia)
  const exercisesTrainedToday = new Set<string>(workoutLogsToday.map((l: any) => l.exercise.name));
  const previousSession: Record<string, {
    date: string;
    logs: { weightKg: number; reps: number; sets: number; rpe: number | null }[];
  }> = {};

  for (const exerciseName of exercisesTrainedToday) {
    const pastLogs = allWorkoutLogs.filter(
      (l) => l.exercise.name === exerciseName && l.date < today
    );
    if (pastLogs.length === 0) continue;

    // allWorkoutLogs está ordenado por date desc → primeiro = mais recente
    const lastDate = pastLogs[0].date.toISOString().slice(0, 10);
    const lastSessionLogs = pastLogs
      .filter((l) => l.date.toISOString().slice(0, 10) === lastDate)
      .map((l) => ({ weightKg: l.weightKg, reps: l.reps, sets: l.sets, rpe: l.rpe }));

    previousSession[exerciseName as string] = { date: lastDate, logs: lastSessionLogs };
  }

  return {
    user,
    protocolDay,
    macrosToday,
    workoutLogsToday,
    dietLogsToday,
    tonnageToday,
    heatmapDays,
    checkIns,
    progression: Array.from(progressionMap.values()),
    previousSession,
  };
}
