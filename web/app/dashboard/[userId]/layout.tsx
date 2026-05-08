import Link from "next/link";
import { LayoutDashboard, Dumbbell, Utensils, Trophy, Activity } from "lucide-react";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200">
      <div className="pb-24">{children}</div>

      {/* Navigation Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] max-w-sm z-50">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-2 flex justify-around items-center shadow-2xl shadow-black/50">
          <NavItem href={`/dashboard/${userId}`} icon={<LayoutDashboard className="w-5 h-5" />} label="Início" />
          <NavItem href={`/dashboard/${userId}/treino`} icon={<Dumbbell className="w-5 h-5" />} label="Treino" />
          <NavItem href={`/dashboard/${userId}/dieta`} icon={<Utensils className="w-5 h-5" />} label="Dieta" />
          <NavItem href={`/dashboard/${userId}/performance`} icon={<Trophy className="w-5 h-5" />} label="Recordes" />
          <NavItem href={`/dashboard/${userId}/saude`} icon={<Activity className="w-5 h-5" />} label="Saúde" />
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      href={href} 
      className="flex flex-col items-center gap-1 p-2 text-slate-500 hover:text-white transition-all active:scale-90"
    >
      {icon}
      <span className="text-[9px] font-bold uppercase tracking-tighter">{label}</span>
    </Link>
  );
}
