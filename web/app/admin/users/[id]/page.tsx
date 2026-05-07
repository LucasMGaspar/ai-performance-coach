import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      workoutLogs: {
        orderBy: { date: "desc" },
        take: 20,
        include: { exercise: true },
      },
      dietLogs: { orderBy: { date: "desc" }, take: 20 },
      checkIns: { orderBy: { date: "desc" }, take: 10 },
    },
  });

  if (!user) notFound();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 text-sm">
            ← Voltar
          </Link>
        </div>

        {/* Perfil */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">{user.name ?? "Sem nome"}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <Stat label="Telefone" value={user.phoneNumber} />
            <Stat label="Peso" value={user.weightKg ? `${user.weightKg}kg` : "—"} />
            <Stat label="Altura" value={user.height ? `${user.height}cm` : "—"} />
            <Stat label="Idade" value={user.age ? `${user.age} anos` : "—"} />
            <Stat label="Meta calorias" value={user.targetCalories ? `${user.targetCalories}kcal` : "—"} />
            <Stat label="Meta proteína" value={user.targetProtein ? `${user.targetProtein}g` : "—"} />
            <Stat label="Registado" value={new Date(user.createdAt).toLocaleDateString("pt-BR")} />
          </div>
        </div>

        {/* Treinos */}
        <Section title="Treinos recentes" count={user.workoutLogs.length}>
          {user.workoutLogs.length === 0 ? (
            <Empty text="Nenhum treino registado ainda." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Exercício</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Carga</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Volume</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">RPE</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {user.workoutLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{log.exercise?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-600">{log.weightKg}kg × {log.reps} × {log.sets}</td>
                    <td className="px-4 py-2 text-gray-600">{log.volume}kg</td>
                    <td className="px-4 py-2 text-gray-600">{log.rpe ?? "—"}</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(log.date).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Dieta */}
        <Section title="Refeições recentes" count={user.dietLogs.length}>
          {user.dietLogs.length === 0 ? (
            <Empty text="Nenhuma refeição registada ainda." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Refeição</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Calorias</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Proteína</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {user.dietLogs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{log.meal}</td>
                    <td className="px-4 py-2 text-gray-600">{log.calories ?? "—"}kcal</td>
                    <td className="px-4 py-2 text-gray-600">{log.protein ?? "—"}g</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(log.date).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Check-ins */}
        <Section title="Check-ins recentes" count={user.checkIns.length}>
          {user.checkIns.length === 0 ? (
            <Empty text="Nenhum check-in registado ainda." />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Humor</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Sono</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Energia</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Data</th>
                </tr>
              </thead>
              <tbody>
                {user.checkIns.map((ci) => (
                  <tr key={ci.id} className="border-b border-gray-50">
                    <td className="px-4 py-2 text-gray-900">{ci.mood ?? "—"}/10</td>
                    <td className="px-4 py-2 text-gray-600">{ci.sleepQuality ?? "—"}/10</td>
                    <td className="px-4 py-2 text-gray-600">{ci.energyLevel ?? "—"}/10</td>
                    <td className="px-4 py-2 text-gray-400 text-xs">{new Date(ci.date).toLocaleDateString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="font-medium text-gray-900">{value}</p>
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className="text-xs text-gray-400">{count} registos</span>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-6 py-8 text-center text-gray-400 text-sm">{text}</p>;
}
