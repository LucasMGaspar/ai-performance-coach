"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Plus, X, Utensils, Info } from "lucide-react";
import { GlassCard } from "./GlassCard";

interface Food {
  id: number;
  description: string;
  category: string;
  energy_kcal: number;
  protein_g: number;
  lipid_g: number;
  carbohydrate_g: number;
}

export function FoodSearchModal({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState<"g" | "un">("g");
  const [loading, setLoading] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);

  // Busca alimentos na API
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (query.length >= 2) {
        setLoading(true);
        try {
          const res = await fetch(`/api/foods/search?q=${query}`);
          const data = await res.json();
          setResults(data);
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  // Detectar unidade padrão ao selecionar
  const handleSelectFood = (food: Food) => {
    setSelectedFood(food);
    const desc = food.description.toLowerCase();
    if (desc.includes("ovo") || desc.includes("pão") || desc.includes("biscoito") || desc.includes("unidade")) {
      setUnit("un");
      setQuantity(1);
    } else {
      setUnit("g");
      setQuantity(100);
    }
    setQuery("");
    setResults([]);
  };

  const handleSave = async () => {
    if (!selectedFood) return;

    // Converter unidade para peso (estimativa padrão para unidades)
    let finalWeight = quantity;
    if (unit === "un") {
      const desc = selectedFood.description.toLowerCase();
      if (desc.includes("ovo")) finalWeight = quantity * 50;
      else if (desc.includes("pão")) finalWeight = quantity * 25;
      else finalWeight = quantity * 100; // Padrão
    }

    const factor = finalWeight / 100;

    const payload = {
      userId,
      meal: selectedFood.description,
      calories: Math.round(selectedFood.energy_kcal * factor),
      protein: Number((selectedFood.protein_g * factor).toFixed(1)),
      carbs: Number((selectedFood.carbohydrate_g * factor).toFixed(1)),
      fat: Number((selectedFood.lipid_g * factor).toFixed(1)),
    };

    try {
      const res = await fetch("/api/diet/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setIsOpen(false);
        setSelectedFood(null);
        window.location.reload(); // Recarregar para atualizar os anéis
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 py-3 rounded-xl transition-all font-bold text-sm"
      >
        <Plus className="w-4 h-4" />
        Adicionar Alimento Precisão
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Utensils className="w-5 h-5 text-cyan-400" />
                <h2 className="text-lg font-bold text-white tracking-tight">Registo de Precisão</h2>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {!selectedFood ? (
                <div className="relative" ref={searchRef}>
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Search className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="Pesquise o alimento (ex: Arroz, Ovo...)"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-cyan-500 transition-all text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                  
                  {loading && (
                    <div className="mt-4 flex justify-center">
                      <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {results.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl max-h-60 overflow-y-auto z-10">
                      {results.map((food) => (
                        <button
                          key={food.id}
                          onClick={() => handleSelectFood(food)}
                          className="w-full text-left p-4 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                        >
                          <p className="text-sm font-bold text-white">{food.description}</p>
                          <p className="text-[10px] text-slate-500 uppercase">{food.category}</p>
                          <div className="flex gap-3 mt-1 text-[10px] text-cyan-400/80 font-mono">
                            <span>{food.energy_kcal}kcal</span>
                            <span>P: {food.protein_g}g</span>
                            <span>C: {food.carbohydrate_g}g</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-cyan-500/5 p-4 rounded-2xl border border-cyan-500/10">
                    <p className="text-cyan-400 text-xs font-bold uppercase mb-1">Selecionado</p>
                    <p className="text-white font-bold">{selectedFood.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Quantidade</label>
                      <input
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-cyan-500 transition-all"
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Unidade</label>
                      <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 h-[50px]">
                        <button
                          onClick={() => setUnit("g")}
                          className={`flex-1 rounded-lg text-xs font-bold transition-all ${unit === "g" ? "bg-cyan-500 text-white shadow-lg" : "text-slate-500"}`}
                        >
                          Grams
                        </button>
                        <button
                          onClick={() => setUnit("un")}
                          className={`flex-1 rounded-lg text-xs font-bold transition-all ${unit === "un" ? "bg-cyan-500 text-white shadow-lg" : "text-slate-500"}`}
                        >
                          Units
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Total Estimado</span>
                      <span className="text-lg font-black text-white">
                        {Math.round(selectedFood.energy_kcal * (unit === "un" ? (quantity * (selectedFood.description.toLowerCase().includes("ovo") ? 50 : 25)) : quantity) / 100)} kcal
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-white/5">
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Prot</p>
                        <p className="text-xs font-bold text-green-400">{(selectedFood.protein_g * (unit === "un" ? (quantity * (selectedFood.description.toLowerCase().includes("ovo") ? 50 : 25)) : quantity) / 100).toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Carb</p>
                        <p className="text-xs font-bold text-orange-400">{(selectedFood.carbohydrate_g * (unit === "un" ? (quantity * (selectedFood.description.toLowerCase().includes("ovo") ? 50 : 25)) : quantity) / 100).toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-slate-500 uppercase">Fat</p>
                        <p className="text-xs font-bold text-purple-400">{(selectedFood.lipid_g * (unit === "un" ? (quantity * (selectedFood.description.toLowerCase().includes("ovo") ? 50 : 25)) : quantity) / 100).toFixed(1)}g</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setSelectedFood(null)}
                      className="flex-1 py-3 border border-white/10 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5"
                    >
                      Voltar
                    </button>
                    <button
                      onClick={handleSave}
                      className="flex-[2] py-3 bg-cyan-500 hover:bg-cyan-400 text-white rounded-xl text-xs font-bold shadow-lg shadow-cyan-500/20"
                    >
                      Salvar Registo
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
