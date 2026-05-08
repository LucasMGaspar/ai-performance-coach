"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";
import { ShareModal } from "./ShareModal";

export function ShareButton({ 
  data 
}: { 
  data: {
    name: string;
    sets: number;
    prs: number;
    score: number;
    streak: number;
    protocolDay: number;
  }
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-500 hover:text-cyan-400"
        title="Compartilhar no Instagram"
      >
        <Share2 className="w-4 h-4" />
      </button>

      <ShareModal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        data={data} 
      />
    </>
  );
}
