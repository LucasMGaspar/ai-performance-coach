import { getUserDashboard } from "@/lib/data";
import { MacroRing } from "@/components/MacroRing";
import { ConsistencyHeatmap } from "@/components/ConsistencyHeatmap";
import { GlassCard } from "@/components/GlassCard";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Activity, Flame, Trophy, Utensils, Droplets, Pill } from "lucide-react";
import { ConsistencyScore } from "@/components/ConsistencyScore";
import { QuickTrackers } from "@/components/QuickTrackers";
import { ShareButton } from "@/components/ShareButton";

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

  const { user, protocolDay, macrosToday, workoutLogsToday, tonnageToday, heatmapDays, prs, checkInToday, totalSetsToday, prsTodayCount } = data;
  const protocolPct = (protocolDay / 80) * 100;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="p-5 pb-24 space-y-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pt-4">
          <div>
            <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Dashboard de Elite</p>
            <h1 className="text-2xl font-black text-white tracking-tight">Olá, {user.name?.split(" ")[0] ?? "Atleta"}</h1>
            <p className="text-slate-500 text-[10px] mt-0.5">Dia {protocolDay} do seu protocolo</p>
          </div>
          <ConsistencyScore score={user.consistencyScore} />
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          <GlassCard className="!p-4 border-l-4 border-l-orange-500">
            <div className="flex items-center gap-2 mb-1">
              <Flame className="w-4 h-4 text-orange-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Streak</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{user.streakCount}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Dias</span>
            </div>
          </GlassCard>

          <GlassCard className="!p-4 border-l-4 border-l-cyan-500">
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-4 h-4 text-cyan-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Max</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{user.maxStreak}</span>
              <span className="text-xs font-bold text-slate-500 uppercase">Dias</span>
            </div>
          </GlassCard>
        </div>

        {/* Trackers Rápidos */}
        <QuickTrackers 
          userId={userId} 
          waterLiters={checkInToday?.waterLiters || 0} 
          supplements={checkInToday?.supplements || []} 
        />

        {/* AI Briefing / Protocol Progress */}
        <GlassCard>
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Estado do Protocolo</h2>
                <p className="text-lg font-bold text-white">{protocolPct.toFixed(1)}% Completo</p>
              </div>
              <Activity className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            
            <div className="h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[2px]">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                style={{ width: `${protocolPct}%` }}
              />
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed italic">
              "Estás no caminho certo, {user.name?.split(" ")[0]}. Mantém a consistência na dieta hoje."
            </p>
          </div>
        </GlassCard>

        {/* Anéis de macros */}
        <GlassCard title="Nutrição de Hoje" icon={<Utensils className="w-3 h-3" />}>
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
        </GlassCard>

        {/* Treino de hoje */}
        <GlassCard 
          title="Sessão de Treino" 
          icon={<Activity className="w-3 h-3" />}
          action={
            <ShareButton data={{
              name: user.name ?? 'Atleta',
              sets: data.totalSetsToday,
              prs: data.prsTodayCount,
              score: user.consistencyScore,
              streak: user.streakCount,
              protocolDay: protocolDay
            }} />
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {workoutLogsToday.length === 0 ? "Sem registos" : `${workoutLogsToday.length} exercícios`}
              </span>
              {tonnageToday > 0 && (
                <div className="flex items-center gap-1 text-cyan-400 font-bold text-xs bg-cyan-400/10 px-2 py-1 rounded-lg">
                  <Trophy className="w-3 h-3" />
                  {(tonnageToday / 1000).toFixed(1)}t Movidas
                </div>
              )}
            </div>
            
            {workoutLogsToday.length === 0 ? (
              <div className="py-4 text-center border-2 border-dashed border-white/5 rounded-xl">
                <p className="text-slate-500 text-xs italic">Nada registrado ainda hoje...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const groups: Record<string, any[]> = {};
                  workoutLogsToday.forEach(log => {
                    if (!groups[log.exercise.name]) groups[log.exercise.name] = [];
                    groups[log.exercise.name].push(log);
                  });
                  
                  return Object.entries(groups).map(([name, logs]) => (
                    <div key={name} className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white text-sm font-bold tracking-tight">{name}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-black">{logs.length} séries</span>
                      </div>
                      <div className="space-y-1">
                        {logs.map((log, idx) => (
                          <div key={log.id} className="flex justify-between items-center text-[10px] text-slate-400 border-t border-white/5 pt-1 first:border-0 first:pt-0">
                             <span>Série {idx + 1}</span>
                             <span className="font-mono text-cyan-400">{log.weightKg}kg × {log.reps}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </GlassCard>

        {/* Heatmap */}
        <GlassCard title="Frequência & Consistência">
          <ConsistencyHeatmap days={heatmapDays} />
        </GlassCard>
      </div>
    </div>
  );
}
