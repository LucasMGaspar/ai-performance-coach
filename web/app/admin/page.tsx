import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { workoutLogs: true, dietLogs: true, checkIns: true } },
    },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI Performance Coach</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} utilizador(es) registado(s)</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Utilizador</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Telefone</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Peso</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Treinos</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Refeições</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Check-ins</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Registado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{user.name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{user.phoneNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{user.weightKg ? `${user.weightKg}kg` : "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-medium text-xs">
                      {user._count.workoutLogs}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-50 text-green-700 font-medium text-xs">
                      {user._count.dietLogs}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-50 text-purple-700 font-medium text-xs">
                      {user._count.checkIns}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 flex gap-3">
                    <Link href={`/dashboard/${user.id}`} className="text-cyan-600 hover:text-cyan-800 font-medium text-xs">
                      Dashboard →
                    </Link>
                    <Link href={`/admin/users/${user.id}`} className="text-blue-600 hover:text-blue-800 font-medium text-xs">
                      Detalhe
                    </Link>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                    Nenhum utilizador registado ainda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
