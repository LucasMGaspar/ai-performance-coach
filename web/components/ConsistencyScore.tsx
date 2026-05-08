"use client";

export function ConsistencyScore({ score }: { score: number }) {
  // Cor baseada no score
  const getColor = (s: number) => {
    if (s >= 90) return "text-emerald-400";
    if (s >= 70) return "text-cyan-400";
    if (s >= 50) return "text-yellow-400";
    return "text-rose-400";
  };

  const getLabel = (s: number) => {
    if (s >= 90) return "Elite";
    if (s >= 70) return "Constante";
    if (s >= 50) return "Em progresso";
    return "Abaixo da meta";
  };

  return (
    <div className="flex flex-col items-center justify-center py-2">
      <div className="relative w-24 h-24 flex items-center justify-center">
        {/* Círculo de fundo */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-white/5"
          />
          {/* Círculo de progresso */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={251.2}
            strokeDashoffset={251.2 - (251.2 * score) / 100}
            strokeLinecap="round"
            fill="transparent"
            className={`${getColor(score)} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{score}</span>
          <span className="text-[8px] font-bold uppercase tracking-tighter text-slate-500">Score</span>
        </div>
      </div>
      <span className={`text-[10px] font-bold uppercase mt-2 tracking-widest ${getColor(score)}`}>
        {getLabel(score)}
      </span>
    </div>
  );
}
