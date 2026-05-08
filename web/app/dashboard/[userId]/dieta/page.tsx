import { GlassCard } from "@/components/GlassCard";
import { Utensils, CheckCircle2, Circle } from "lucide-react";
import { getUserDashboard } from "@/lib/data";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DietPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const { scheduledMeals, dietLogsToday } = await getUserDashboard(userId);

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
       <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-500/10 blur-[120px] rounded-full" />
      </div>

      <div className="p-5 pb-24 space-y-6 max-w-lg mx-auto">
        <div className="pt-4">
          <Link href={`/dashboard/${userId}`} className="text-xs text-cyan-400 font-bold uppercase tracking-widest mb-2 block">← Voltar</Link>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <Utensils className="text-orange-500 w-6 h-6" />
            Protocolo Alimentar
          </h1>
          <p className="text-slate-500 text-sm mt-1">Comparativo entre o planeado e o realizado.</p>
        </div>

        <div className="space-y-4">
          {scheduledMeals.length === 0 ? (
            <p className="text-slate-500 text-center py-10 italic">Nenhum plano alimentar definido.</p>
          ) : (
            scheduledMeals.map((meal: any) => {
              // Verificar se o utilizador já registou esta refeição hoje
              // Lógica simples: se o nome da refeição aparecer nos logs de hoje
              const isLogged = dietLogsToday.some(log => 
                log.meal.toLowerCase().includes(meal.mealName.toLowerCase()) ||
                meal.mealName.toLowerCase().includes(log.meal.toLowerCase())
              );

              return (
                <GlassCard key={meal.id}>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {isLogged ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-slate-700" />}
                        <h3 className="font-bold text-white">{meal.mealName}</h3>
                      </div>
                      <p className="text-xs text-slate-400">{meal.scheduledTime} — {meal.description}</p>
                      <div className="flex gap-2 pt-1">
                        <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{meal.targetCalories} kcal</span>
                        <span className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{meal.targetProtein}g prot</span>
                      </div>
                    </div>
                    {isLogged && (
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-1 rounded">Realizado</span>
                    )}
                  </div>
                </GlassCard>
              );
            })
          )}
        </div>

        <GlassCard title="Dica da IA">
          <p className="text-xs text-slate-400 leading-relaxed italic">
            "Parece que você está sendo consistente com o Café da manhã. Tente garantir que o Jantar não passe das 21h para melhorar a qualidade do sono."
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
