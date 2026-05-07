import { getUserDashboard } from "@/lib/data";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function TreinoPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  let data;
  try {
    data = await getUserDashboard(userId);
  } catch {
    notFound();
  }

  const { workoutLogsToday, tonnageToday, previousSession } = data;

  // Agrupar logs de hoje por exercício
  const byExercise = new Map<string, typeof workoutLogsToday>();
  for (const log of workoutLogsToday) {
    const name = log.exercise.name;
    if (!byExercise.has(name)) byExercise.set(name, []);
    byExercise.get(name)!.push(log);
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-xl font-bold text-white">Treino de Hoje</h1>
        {tonnageToday > 0 && (
          <div className="text-right">
            <p className="text-lg font-black text-cyan-400">{(tonnageToday / 1000).toFixed(2)}t</p>
            <p className="text-[10px] text-slate-500">tonelagem total</p>
          </div>
        )}
      </div>

      {workoutLogsToday.length === 0 ? (
        <div className="bg-slate-800 rounded-xl p-8 text-center">
          <p className="text-slate-400 text-sm">Nenhum treino registado hoje.</p>
          <p className="text-slate-600 text-xs mt-1">Envia uma mensagem no WhatsApp para registar.</p>
        </div>
      ) : (
        Array.from(byExercise.entries()).map(([name, logs]) => {
          const totalVol = logs.reduce((a, l) => a + l.volume, 0);
          const prev = previousSession[name];
          const prevMaxWeight = prev ? Math.max(...prev.logs.map((l: any) => l.weightKg)) : null;
          const currentMaxWeight = Math.max(...logs.map((l: any) => l.weightKg));
          const isNewPR = prev && currentMaxWeight > prevMaxWeight!;

          return (
            <div key={name} className="bg-slate-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-white">{name}</h2>
                    {isNewPR && (
                      <span className="text-[10px] font-bold bg-yellow-400/20 text-yellow-400 px-1.5 py-0.5 rounded">PR</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{logs[0].exercise.muscleGroup}</p>
                </div>
                <span className="text-xs text-cyan-400 font-semibold">{totalVol}kg volume</span>
              </div>

              {/* Referência da sessão anterior */}
              {prev && (
                <div className="px-4 py-2 bg-slate-700/30 border-b border-slate-700/50 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide">Última</span>
                  <span className="text-[10px] text-slate-400">{prev.date.slice(5)}</span>
                  <span className="text-slate-600 text-[10px]">·</span>
                  <div className="flex gap-2 flex-wrap">
                    {prev.logs.map((l, i) => (
                      <span key={i} className={`text-[10px] font-medium ${l.weightKg >= currentMaxWeight ? "text-slate-300" : "text-slate-500"}`}>
                        {l.weightKg}kg×{l.reps}×{l.sets}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {!prev && (
                <div className="px-4 py-2 bg-slate-700/20 border-b border-slate-700/50">
                  <span className="text-[10px] text-slate-600">Primeira sessão registada</span>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs border-b border-slate-700/50">
                    <th className="text-left px-4 py-2">Série</th>
                    <th className="text-center px-4 py-2">Carga</th>
                    <th className="text-center px-4 py-2">Reps</th>
                    <th className="text-center px-4 py-2">Séries</th>
                    <th className="text-center px-4 py-2">RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => {
                    const prevRef = prev?.logs[i];
                    const improved = prevRef && log.weightKg > prevRef.weightKg;
                    return (
                      <tr key={log.id} className="border-b border-slate-700/30 last:border-0">
                        <td className="px-4 py-2 text-slate-400">#{i + 1}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`font-bold ${improved ? "text-cyan-400" : "text-white"}`}>
                            {log.weightKg}kg
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-slate-300">{log.reps}</td>
                        <td className="px-4 py-2 text-center text-slate-300">{log.sets}</td>
                        <td className="px-4 py-2 text-center">
                          {log.rpe ? (
                            <span className={`text-xs font-bold ${log.rpe >= 9 ? "text-red-400" : log.rpe >= 8 ? "text-orange-400" : "text-green-400"}`}>
                              {log.rpe}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </div>
  );
}
