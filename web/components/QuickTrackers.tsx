"use client";

import { Droplets, Pill, Plus, CheckCircle2 } from "lucide-react";
import { updateWater, toggleSupplement } from "@/lib/actions";
import { useState } from "react";

export function QuickTrackers({ 
  userId, 
  waterLiters, 
  supplements 
}: { 
  userId: string, 
  waterLiters: number, 
  supplements: string[] 
}) {
  const [loading, setLoading] = useState(false);

  const handleAddWater = async () => {
    setLoading(true);
    await updateWater(userId, 0.25); // +250ml
    setLoading(false);
  };

  const handleToggleSupp = async (name: string) => {
    setLoading(true);
    await toggleSupplement(userId, name);
    setLoading(false);
  };

  const availableSupps = ["Creatina", "Whey", "Pré-treino"];

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Água */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-blue-500/20 rounded-lg">
            <Droplets className="w-4 h-4 text-blue-400" />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-tighter">Água</span>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-xl font-black text-white">{waterLiters.toFixed(2)}</span>
          <span className="text-[10px] text-slate-500 font-bold uppercase">L</span>
        </div>
        <button 
          onClick={handleAddWater}
          disabled={loading}
          className="w-full py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[10px] font-bold uppercase">250ml</span>
        </button>
      </div>

      {/* Suplementos */}
      <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-purple-500/20 rounded-lg">
            <Pill className="w-4 h-4 text-purple-400" />
          </div>
          <span className="text-xs font-bold text-white uppercase tracking-tighter">Suplementos</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableSupps.map(s => {
            const isTaken = supplements.includes(s);
            return (
              <button
                key={s}
                onClick={() => handleToggleSupp(s)}
                disabled={loading}
                className={`text-[9px] font-bold uppercase px-2 py-1 rounded-lg transition-all border ${
                  isTaken 
                  ? "bg-purple-500/20 text-purple-400 border-purple-500/30" 
                  : "bg-white/5 text-slate-500 border-white/5"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
