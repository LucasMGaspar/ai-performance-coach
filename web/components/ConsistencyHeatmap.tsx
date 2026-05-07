"use client";

type DayType = "both" | "workout" | "diet" | "none";

interface HeatmapDay {
  date: string;
  type: DayType;
}

const colors: Record<DayType, string> = {
  both: "bg-cyan-400",
  workout: "bg-blue-500",
  diet: "bg-green-500",
  none: "bg-slate-700",
};

export function ConsistencyHeatmap({ days }: { days: HeatmapDay[] }) {
  // Split into weeks (columns of 7)
  const weeks: HeatmapDay[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <div>
      <div className="flex gap-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={day.date}
                className={`w-3 h-3 rounded-sm ${colors[day.type]}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2">
        {(["both", "workout", "diet", "none"] as DayType[]).map((t) => (
          <div key={t} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${colors[t]}`} />
            <span className="text-[10px] text-slate-500">
              {t === "both" ? "Treino+Dieta" : t === "workout" ? "Treino" : t === "diet" ? "Dieta" : "Sem registo"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
