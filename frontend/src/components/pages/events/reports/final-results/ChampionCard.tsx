import React from "react";
import Icon from "@/components/ui/Icon";

interface Winner {
  rank: number;
  team: string;
  school: string;
  score: number;
}

export default function ChampionCard({ winner }: { winner: Winner }) {
  return (
    <div 
      className="rounded-2xl p-10 text-center text-white shadow-xl animate-in zoom-in-95 duration-500" 
      style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-white/20 mb-6 backdrop-blur-sm">
        <Icon name="emoji_events" size={48} className="text-yellow-300" />
      </div>
      <h2 className="text-4xl font-bold mb-2 tracking-tight">優勝</h2>
      <h3 className="text-3xl font-medium mb-2">{winner.team}</h3>
      <p className="text-xl opacity-80 mb-6">{winner.school}</p>
      <div className="inline-flex items-center gap-2 px-6 py-2 bg-black/20 rounded-full text-lg font-medium backdrop-blur-sm">
        <span className="opacity-70 text-sm uppercase tracking-widest">Score</span>
        {winner.score} 点
      </div>
    </div>
  );
}
