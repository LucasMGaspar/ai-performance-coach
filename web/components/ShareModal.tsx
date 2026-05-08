"use client";

import { X, Download, Share2, Flame, Trophy, Activity, Dumbbell } from "lucide-react";
import { GlassCard } from "./GlassCard";

export function ShareModal({ 
  isOpen, 
  onClose, 
  data 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  data: {
    name: string;
    sets: number;
    prs: number;
    score: number;
    streak: number;
    protocolDay: number;
  }
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-8 bg-black/95 backdrop-blur-xl overflow-y-auto">
      {/* Botão de Fechar */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-[100]"
      >
        <X className="w-6 h-6" />
      </button>

      <div className="w-full max-w-[360px] my-auto animate-in fade-in zoom-in duration-300">
        {/* The Card */}
        <div id="share-card" className="relative aspect-[9/16] w-full bg-black rounded-[3rem] overflow-hidden shadow-[0_0_60px_rgba(0,0,0,0.8)] border border-white/10">
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/share-bg.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
          
          <div className="relative h-full flex flex-col p-8 sm:p-10 justify-between">
            {/* Top Brand */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-cyan-500 flex items-center justify-center rounded-2xl rotate-3 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                  <Dumbbell className="w-6 h-6 text-black -rotate-3" />
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black tracking-tighter text-lg italic leading-none">AI COACH</span>
                  <span className="text-cyan-400 font-bold text-[7px] uppercase tracking-[0.3em]">Performance</span>
                </div>
              </div>
            </div>

            {/* Middle Section: THE SCORE */}
            <div className="flex flex-col items-center text-center">
               <div className="bg-black/40 backdrop-blur-lg p-6 sm:p-8 rounded-[3rem] border border-white/10 w-full">
                  <p className="text-cyan-400 font-black uppercase tracking-[0.4em] text-[9px] mb-3">Performance</p>
                  <h1 className="text-8xl font-black text-white tracking-tighter italic leading-none mb-1">
                    {data.score}<span className="text-4xl text-white/30 ml-1">%</span>
                  </h1>
               </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
               <div className="bg-white/5 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 flex flex-col items-center text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Séries Totais</p>
                  <p className="text-3xl font-black text-white italic">{data.sets}</p>
               </div>

               <div className="bg-white/5 backdrop-blur-xl p-5 rounded-[2rem] border border-white/10 flex flex-col items-center text-center">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-1">Recordes (PR)</p>
                  <p className="text-3xl font-black text-emerald-400 italic">+{data.prs}</p>
               </div>
            </div>

            {/* Bottom Section */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 bg-orange-500/10 border border-orange-500/20 px-4 py-3 rounded-2xl">
                 <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
                 <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-orange-500/60">Fogo Constante</p>
                    <p className="text-sm font-black text-white uppercase italic">{data.streak} Dias Seguidos</p>
                 </div>
              </div>

              <div className="flex justify-between items-end border-t border-white/5 pt-4">
                <div className="flex flex-col">
                   <p className="text-white/40 text-[8px] font-bold uppercase tracking-widest mb-0.5 italic">Atleta</p>
                   <p className="text-white font-black text-lg tracking-tight leading-none italic">{data.name}</p>
                </div>
                <div className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">
                  DIA {data.protocolDay}/80
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button 
          className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-white/10 mt-4"
          onClick={() => alert('Dica: Tire um print e poste no seu Story! 📸')}
        >
          <Share2 className="w-5 h-5" />
          <span className="text-sm uppercase tracking-tight font-black">Postar no Instagram</span>
        </button>
      </div>
    </div>
  );
}
