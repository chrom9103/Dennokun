import React from "react";
import Icon from "@/components/ui/Icon";

interface MatchStats {
  total: number;
  done: number;
  live: number;
  plan: number;
}

export default function MatchBoardStats({ stats }: { stats: MatchStats }) {
  const items = [
    { label: "全試合数", value: stats.total, color: "bg-primary" },
    { label: "完了", value: stats.done, color: "bg-success" },
    { label: "進行中", value: stats.live, color: "bg-warning" },
    { label: "予定", value: stats.plan, color: "bg-muted-foreground" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div key={i} className={`${item.color} text-white rounded-xl p-5 shadow-sm transition-transform hover:scale-[1.02]`}>
          <p className="text-xs opacity-80 font-semibold uppercase tracking-wider mb-1">{item.label}</p>
          <p className="text-3xl font-bold tracking-tight">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
