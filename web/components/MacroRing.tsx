"use client";

interface MacroRingProps {
  label: string;
  current: number;
  target: number;
  color: string;
  unit?: string;
}

export function MacroRing({ label, current, target, color, unit = "g" }: MacroRingProps) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-white">{Math.round(pct * 100)}%</span>
        </div>
      </div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-xs font-semibold text-white">
        {Math.round(current)}<span className="text-slate-500">/{Math.round(target)}{unit}</span>
      </p>
    </div>
  );
}
