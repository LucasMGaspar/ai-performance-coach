import { getUserDashboard } from "@/lib/data";
import Link from "next/link";
import { HealthChart } from "@/components/HealthChart";
import { GlassCard } from "@/components/GlassCard";
import { Activity, Moon, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HealthPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { checkIns } = await getUserDashboard(userId);

  // Formatar dados para o gráfico (reverter para ordem cronológica)
  const chartData = [...checkIns].reverse().map(c => ({
    date: new Date(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    mood: c.mood,
    sleep: c.sleepQuality,
    energy: c.energyLevel,
  }));

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
       <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="p-5 pb-24 space-y-6 max-w-lg mx-auto">
        <div className="pt-4">
          <Link href={`/dashboard/${userId}`} className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2 block">← Voltar</Link>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Activity className="text-blue-500 w-6 h-6" />
            Saúde & Recuperação
          </h1>
          <p className="text-slate-500 text-sm mt-1">Monitorização biofeedback.</p>
        </div>

        {checkIns.length === 0 ? (
          <p className="text-slate-500 text-center py-10 italic">Ainda não tens check-ins de saúde.</p>
        ) : (
          <>
            <GlassCard title="Biofeedback (últimos registos)">
              <HealthChart data={chartData} />
              <div className="flex justify-center gap-4 mt-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Sono</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Energia</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Humor</span>
                </div>
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 gap-4">
              <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Notas Recentes</h2>
              {checkIns.slice(0, 3).map((c: any) => (
                <GlassCard key={c.id}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-slate-500 font-bold">{new Date(c.date).toLocaleDateString('pt-BR')}</span>
                    <div className="flex gap-2">
                      <span className="text-xs flex items-center gap-1"><Moon className="w-3 h-3 text-blue-400"/> {c.sleepQuality}</span>
                      <span className="text-xs flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-400"/> {c.energyLevel}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 italic">"{c.notes || "Sem observações."}"</p>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
