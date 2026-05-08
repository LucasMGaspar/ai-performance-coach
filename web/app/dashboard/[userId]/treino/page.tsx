import { GlassCard } from "@/components/GlassCard";
import { Dumbbell, TrendingUp, History } from "lucide-react";
import { getUserDashboard } from "@/lib/data";
import Link from "next/link";
import { WorkoutChart } from "@/components/WorkoutChart";
import { ShareButton } from "@/components/ShareButton";

export const dynamic = "force-dynamic";

export default async function WorkoutPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { user, protocolDay, progression, workoutLogsToday, tonnageToday, totalSetsToday, prsTodayCount } = await getUserDashboard(userId);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
       <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="p-5 pb-24 space-y-6 max-w-lg mx-auto">
        <div className="pt-4">
          <Link href={`/dashboard/${userId}`} className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2 block">← Voltar</Link>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Dumbbell className="text-cyan-500 w-6 h-6" />
            Análise de Treino
          </h1>
          <p className="text-slate-500 text-sm mt-1">Evolução de carga e volume.</p>
        </div>

        {/* Hoje */}
        <GlassCard 
          title="Sessão de Hoje" 
          icon={<History className="w-3 h-3" />}
          action={
            <ShareButton data={{
              name: user.name ?? 'Atleta',
              sets: totalSetsToday,
              prs: prsTodayCount,
              score: user.consistencyScore,
              streak: user.streakCount,
              protocolDay: protocolDay
            }} />
          }
        >
           {workoutLogsToday.length === 0 ? (
             <p className="text-slate-500 text-xs italic py-2">Ainda não treinou hoje. Bora!</p>
           ) : (
             <div className="space-y-4">
                {(() => {
                  const groups: Record<string, any[]> = {};
                  workoutLogsToday.forEach(log => {
                    if (!groups[log.exercise.name]) groups[log.exercise.name] = [];
                    groups[log.exercise.name].push(log);
                  });
                  
                  return Object.entries(groups).map(([name, logs]) => (
                    <div key={name} className="border-b border-white/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-bold text-sm">{name}</span>
                        <span className="text-[10px] text-slate-500 uppercase">{logs.length} séries</span>
                      </div>
                      <div className="space-y-1 pl-1">
                        {logs.map((log, idx) => (
                          <div key={log.id} className="flex justify-between items-center text-xs text-slate-400">
                             <span className="text-[10px]">Série {idx + 1}</span>
                             <span className="text-cyan-400 font-mono">{log.weightKg}kg × {log.reps}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
             </div>
           )}
        </GlassCard>

        {/* Evolução por Exercício */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Progressão de Carga</h2>
          {progression.length === 0 ? (
            <p className="text-slate-500 text-center py-10 italic">Sem dados de progressão suficientes.</p>
          ) : (
            progression.map((item: any) => (
              <GlassCard key={item.name} title={item.name} icon={<TrendingUp className="w-3 h-3" />}>
                <div className="flex justify-between items-end mb-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Histórico de Peso</span>
                  <span className="text-xs font-bold text-white">{item.data[item.data.length - 1]?.weight}kg máx</span>
                </div>
                {/* Usando o componente cliente para o gráfico de progressão */}
                <p className="text-[10px] text-slate-400 italic">Evolução nas últimas {item.data.length} sessões</p>
                <WorkoutChart data={item.data} />
              </GlassCard>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
