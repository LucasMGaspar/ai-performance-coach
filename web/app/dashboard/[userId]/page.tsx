import { getUserDashboard } from "@/lib/data";
import { MacroRing } from "@/components/MacroRing";
import { ConsistencyHeatmap } from "@/components/ConsistencyHeatmap";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  let data;
  try {
    data = await getUserDashboard(userId);
  } catch (error: any) {
    return (
      <div className="p-8 text-white">
        <h1 className="text-red-500 font-bold text-xl mb-4">Erro Crítico</h1>
        <pre className="bg-slate-900 p-4 rounded text-xs overflow-auto">
          {error?.message || String(error)}
        </pre>
      </div>
    );
  }

  const { user, protocolDay, macrosToday, workoutLogsToday, tonnageToday, heatmapDays } = data;
  const protocolPct = (protocolDay / 80) * 100;

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <p className="text-slate-400 text-sm">Olá, {user.name?.split(" ")[0] ?? "Atleta"}</p>
          <h1 className="text-xl font-bold text-white">QG de Performance</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-cyan-400">Dia {protocolDay}</p>
          <p className="text-xs text-slate-500">de 80</p>
        </div>
      </div>

      {/* Barra de progresso do protocolo */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex justify-between text-xs text-slate-400 mb-2">
          <span>Progresso do protocolo</span>
          <span>{protocolPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
            style={{ width: `${protocolPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
          <span>Dia 1</span>
          <span>Dia 80</span>
        </div>
      </div>

      {/* Anéis de macros */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Macros de hoje</h2>
        <div className="grid grid-cols-4 gap-2">
          <MacroRing
            label="Calorias"
            current={macrosToday.calories}
            target={user.targetCalories ?? 2000}
            color="#22d3ee"
            unit="kcal"
          />
          <MacroRing
            label="Proteína"
            current={macrosToday.protein}
            target={user.targetProtein ?? 150}
            color="#4ade80"
          />
          <MacroRing
            label="Carbs"
            current={macrosToday.carbs}
            target={Math.round((user.targetCalories ?? 2000) * 0.4 / 4)}
            color="#fb923c"
          />
          <MacroRing
            label="Gordura"
            current={macrosToday.fat}
            target={Math.round((user.targetCalories ?? 2000) * 0.25 / 9)}
            color="#a78bfa"
          />
        </div>
      </div>

      {/* Treino de hoje */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-300">Treino de hoje</h2>
          {tonnageToday > 0 && (
            <span className="text-xs bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full">
              {(tonnageToday / 1000).toFixed(1)}t tonelagem
            </span>
          )}
        </div>
        {workoutLogsToday.length === 0 ? (
          <p className="text-slate-500 text-sm">Nenhum treino registado hoje.</p>
        ) : (
          <div className="space-y-2">
            {workoutLogsToday.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
                <span className="text-white text-sm font-medium">{log.exercise.name}</span>
                <span className="text-slate-400 text-xs">
                  {log.weightKg}kg × {log.reps} × {log.sets}
                  {log.rpe ? <span className="text-cyan-400 ml-1">RPE {log.rpe}</span> : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Heatmap */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Consistência — últimas 12 semanas</h2>
        <ConsistencyHeatmap days={heatmapDays} />
      </div>
    </div>
  );
}
