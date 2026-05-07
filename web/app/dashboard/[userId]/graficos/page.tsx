"use client";

import { useEffect, useState } from "react";
import { ProgressChart } from "@/components/ProgressChart";

interface ProgressionData {
  name: string;
  data: { date: string; weight: number; volume: number }[];
}

interface CheckIn {
  date: string;
  mood: number;
  sleepQuality: number;
  energyLevel: number;
}

export default function GraficosPage({ params }: { params: Promise<{ userId: string }> }) {
  const [userId, setUserId] = useState("");
  const [progression, setProgression] = useState<ProgressionData[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [selected, setSelected] = useState("");
  const [metric, setMetric] = useState<"weight" | "volume">("weight");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(({ userId: id }) => {
      setUserId(id);
      fetch(`/api/dashboard/${id}`)
        .then((r) => r.json())
        .then((d) => {
          setProgression(d.progression ?? []);
          setCheckIns(d.checkIns ?? []);
          if (d.progression?.length > 0) setSelected(d.progression[0].name);
          setLoading(false);
        });
    });
  }, [params]);

  const selectedData = progression.find((p) => p.name === selected)?.data ?? [];

  const checkInData = [...checkIns].reverse().map((c) => ({
    date: new Date(c.date).toISOString().slice(5, 10),
    mood: c.mood,
    sleep: c.sleepQuality,
    energy: c.energyLevel,
  }));

  if (loading) {
    return (
      <div className="p-4 pt-6 text-center text-slate-500">
        <div className="animate-pulse">A carregar gráficos...</div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-bold text-white pt-2">Gráficos de Análise</h1>

      {/* Progressão de carga */}
      <div className="bg-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Progressão de carga</h2>
          <div className="flex gap-2">
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="text-xs bg-slate-700 text-white border border-slate-600 rounded px-2 py-1 focus:outline-none"
            >
              {progression.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
            <button
              onClick={() => setMetric(metric === "weight" ? "volume" : "weight")}
              className="text-xs bg-slate-700 text-cyan-400 border border-slate-600 rounded px-2 py-1"
            >
              {metric === "weight" ? "Carga" : "Volume"}
            </button>
          </div>
        </div>
        {selectedData.length < 2 ? (
          <p className="text-slate-500 text-sm py-6 text-center">Precisa de pelo menos 2 sessões para mostrar o gráfico.</p>
        ) : (
          <ProgressChart data={selectedData} metric={metric} />
        )}
      </div>

      {/* Biofeedback */}
      <div className="bg-slate-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Biofeedback — check-ins</h2>
        {checkInData.length < 2 ? (
          <p className="text-slate-500 text-sm py-6 text-center">Precisa de pelo menos 2 check-ins.</p>
        ) : (
          <div className="space-y-3">
            {checkInData.slice(-7).map((c) => (
              <div key={c.date} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-12">{c.date}</span>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${c.mood * 10}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">Humor {c.mood}</p>
                  </div>
                  <div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-400 rounded-full" style={{ width: `${c.sleep * 10}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">Sono {c.sleep}</p>
                  </div>
                  <div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${c.energy * 10}%` }} />
                    </div>
                    <p className="text-[10px] text-slate-600 mt-0.5">Energia {c.energy}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
