import Link from "next/link";
import { LayoutDashboard, Dumbbell, UtensilsCrossed, TrendingUp } from "lucide-react";

const navItems = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/treino", label: "Treino", icon: Dumbbell },
  { href: "/dieta", label: "Dieta", icon: UtensilsCrossed },
  { href: "/graficos", label: "Gráficos", icon: TrendingUp },
];

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <div className="flex-1 overflow-auto pb-20">{children}</div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex justify-around z-50">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={`/dashboard/${userId}${href}`}
            className="flex flex-col items-center gap-0.5 py-3 px-4 text-slate-400 hover:text-cyan-400 transition-colors"
          >
            <Icon size={20} />
            <span className="text-[10px]">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
