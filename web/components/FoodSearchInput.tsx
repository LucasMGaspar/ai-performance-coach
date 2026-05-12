"use client";

import { useState, useEffect } from "react";
import { Search, Plus, X } from "lucide-react";

interface Food {
  id: number;
  description: string;
  category: string;
  energy_kcal: number;
  protein_g: number;
  lipid_g: number;
  carbohydrate_g: number;
}

interface FoodSearchInputProps {
  onSelect: (food: Food, quantity: number, unit: "g" | "un") => void;
  placeholder?: string;
}

export function FoodSearchInput({ onSelect, placeholder = "Pesquisar alimento..." }: FoodSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState<number>(100);
  const [unit, setUnit] = useState<"g" | "un">("g");

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

  const handleSelect = (food: Food) => {
    setSelectedFood(food);
    const desc = food.description.toLowerCase();
    if (desc.includes("ovo") || desc.includes("unidade") || desc.includes("pão") || desc.includes("fatia") || desc.includes("whey") || desc.includes("pasta de amendoim")) {
      setUnit("un");
      setQuantity(1);
    } else {
      setUnit("g");
      setQuantity(100);
    }
    setQuery("");
    setResults([]);
  };

  const handleAdd = () => {
    if (selectedFood) {
      onSelect(selectedFood, quantity, unit);
      setSelectedFood(null);
      setQuantity(100);
      setUnit("g");
    }
  };

  return (
    <div className="relative space-y-3">
      {!selectedFood ? (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder={placeholder}
            className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-orange-500 transition-all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {results.length > 0 && (
            <div className="absolute top-full left-0 w-full mt-1 bg-slate-900 border border-white/10 rounded-lg overflow-hidden shadow-2xl z-20 max-h-48 overflow-y-auto">
              {results.map((food) => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => handleSelect(food)}
                  className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors"
                >
                  <p className="text-xs font-bold text-white">{food.description}</p>
                  <p className="text-[9px] text-slate-500 uppercase">{food.category}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3 space-y-3 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-start">
            <p className="text-xs font-bold text-white leading-tight pr-4">{selectedFood.description}</p>
            <button onClick={() => setSelectedFood(null)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex gap-2">
            <input
              type="number"
              className="w-20 bg-white/5 border border-white/10 rounded-md py-1.5 px-2 text-xs text-white"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
            <div className="flex bg-white/5 rounded-md p-0.5 border border-white/10">
              <button
                type="button"
                onClick={() => setUnit("g")}
                className={`px-2 py-1 rounded text-[10px] font-bold ${unit === "g" ? "bg-orange-500 text-white" : "text-slate-500"}`}
              >
                g
              </button>
              <button
                type="button"
                onClick={() => setUnit("un")}
                className={`px-2 py-1 rounded text-[10px] font-bold ${unit === "un" ? "bg-orange-500 text-white" : "text-slate-500"}`}
              >
                un
              </button>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-black uppercase rounded-md px-3 transition-colors flex items-center justify-center gap-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
