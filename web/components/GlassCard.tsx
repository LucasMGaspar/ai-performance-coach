import { ReactNode } from "react";

export function GlassCard({ children, title, icon, action }: { children: ReactNode; title?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="relative overflow-hidden bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl p-5 shadow-xl shadow-black/20">
      {/* Subtle top light effect */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-100/90 flex items-center gap-2 uppercase tracking-widest text-[10px]">
            {icon && <span className="text-cyan-400">{icon}</span>}
            {title}
          </h3>
          {action && <div>{action}</div>}
        </div>
      )}
      
      {children}
    </div>
  );
}
