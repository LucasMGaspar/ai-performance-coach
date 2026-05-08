import { GlassCard } from "@/components/GlassCard";
import { Trophy, Calendar, Weight } from "lucide-react";
import { getUserDashboard } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PerformancePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { prs, user } = await getUserDashboard(userId);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
       {/* Background Glows */}
       <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="p-5 pb-24 space-y-6 max-w-lg mx-auto">
        <div className="pt-4">
          <Link href={`/dashboard/${userId}`} className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2 block">← Voltar</Link>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Trophy className="text-yellow-500 w-6 h-6" />
            Galeria de Recordes
          </h1>
          <p className="text-slate-500 text-sm mt-1">Seus maiores feitos na academia.</p>
        </div>

        {prs.length === 0 ? (
          <GlassCard>
            <div className="py-12 text-center">
              <Trophy className="w-12 h-12 text-slate-800 mx-auto mb-4" />
              <p className="text-slate-400 text-sm">Ainda não tem recordes registrados.</p>
              <p className="text-slate-600 text-xs mt-1">Registre um treino no WhatsApp para começar!</p>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {prs.map((pr: any) => (
              <GlassCard key={pr.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{pr.exercise.name}</h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {new Date(pr.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className="text-2xl font-black text-cyan-400">{pr.weightKg}</span>
                      <span className="text-xs text-slate-500 font-bold uppercase">kg</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">× {pr.reps} reps</p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {/* Feed de Vitórias (Timeline) */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Linha do Tempo de Vitórias</h2>
          <div className="space-y-3 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5">
            {prs.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5).map((pr: any) => (
              <div key={pr.id} className="relative pl-10">
                <div className="absolute left-2.5 top-2 w-3 h-3 rounded-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] border-2 border-[#020617]" />
                <GlassCard className="!p-3">
                  <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">
                    {new Date(pr.date).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
                  </p>
                  <p className="text-sm text-white">
                    Você superou seu recorde no <span className="font-bold text-cyan-400">{pr.exercise.name}</span>!
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Nova marca: <span className="font-bold text-white">{pr.weightKg}kg</span> × {pr.reps} reps
                  </p>
                </GlassCard>
              </div>
            ))}
          </div>
        </div>

        <GlassCard title="Insights de Performance">
           <p className="text-xs text-slate-400 leading-relaxed">
             O seu volume total de treino subiu **12%** esta semana. Se você mantiver este ritmo, a IA sugere aumentar o peso no Supino na próxima sessão.
           </p>
        </GlassCard>
      </div>
    </div>
  );
}
