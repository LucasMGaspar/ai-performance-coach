import { getUserDashboard } from "@/lib/data";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DietaPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;

  let data;
  try {
    data = await getUserDashboard(userId);
  } catch {
    notFound();
  }

  const { user, macrosToday, dietLogsToday } = data;

  const targets = {
    calories: user.targetCalories ?? 2000,
    protein: user.targetProtein ?? 150,
    carbs: Math.round((user.targetCalories ?? 2000) * 0.4 / 4),
    fat: Math.round((user.targetCalories ?? 2000) * 0.25 / 9),
  };

  function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
    const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    return (
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-slate-400">{label}</span>
          <span className="text-white font-medium">{Math.round(current)} / {Math.round(target)}</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="pt-2">
        <h1 className="text-xl font-bold text-white">Dieta de Hoje</h1>
        <p className="text-slate-400 text-sm">{dietLogsToday.length} refeição(ões) registada(s)</p>
      </div>

      {/* Resumo de macros */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-300">Balanço do dia</h2>
          <span className={`text-sm font-bold ${macrosToday.calories >= targets.calories ? "text-cyan-400" : "text-slate-400"}`}>
            {Math.round(macrosToday.calories)} kcal
          </span>
        </div>
        <MacroBar label="Calorias" current={macrosToday.calories} target={targets.calories} color="#22d3ee" />
        <MacroBar label="Proteína (g)" current={macrosToday.protein} target={targets.protein} color="#4ade80" />
        <MacroBar label="Carboidratos (g)" current={macrosToday.carbs} target={targets.carbs} color="#fb923c" />
        <MacroBar label="Gordura (g)" current={macrosToday.fat} target={targets.fat} color="#a78bfa" />
      </div>

      {/* Lista de refeições */}
      <div className="bg-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h2 className="text-sm font-semibold text-slate-300">Refeições registadas</h2>
        </div>
        {dietLogsToday.length === 0 ? (
          <p className="px-4 py-8 text-center text-slate-500 text-sm">
            Nenhuma refeição registada hoje.<br />
            <span className="text-xs text-slate-600">Envia no WhatsApp: "Almoço: frango com arroz, 500kcal, 40g proteína"</span>
          </p>
        ) : (
          dietLogsToday.map((log: any) => (
            <div key={log.id} className="px-4 py-3 border-b border-slate-700/50 last:border-0">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-white text-sm">{log.meal}</span>
                <span className="text-cyan-400 text-sm font-bold">{Math.round(log.calories)} kcal</span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500">
                {log.protein > 0 && <span className="text-green-400">{Math.round(log.protein)}g prot</span>}
                {log.carbs != null && log.carbs > 0 && <span className="text-orange-400">{Math.round(log.carbs)}g carbs</span>}
                {log.fat != null && log.fat > 0 && <span className="text-purple-400">{Math.round(log.fat)}g fat</span>}
                <span className="text-slate-600">{new Date(log.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
