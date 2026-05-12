import React from "react";
import Icon from "@/components/ui/Icon";
import { Card, CardContent } from "@/components/ui/Card";

interface Winner {
  rank: number;
  team: string;
  school: string;
  score: number;
}

export default function RunnerUpCard({ winner }: { winner: Winner }) {
  const isSecond = winner.rank === 2;
  const rankLabel = isSecond ? "準優勝" : "第3位";
  const iconColor = isSecond ? "text-slate-400" : "text-amber-600";
  const bgColor = isSecond ? "bg-slate-50" : "bg-amber-50/50";

  return (
    <Card className={`${bgColor} border-none shadow-sm`}>
      <CardContent className="p-8 text-center">
        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full bg-white mb-4 shadow-sm ${iconColor}`}>
          <Icon name="emoji_events" size={32} />
        </div>
        <h3 className="text-xl font-bold mb-1">{rankLabel}</h3>
        <p className="text-lg font-medium text-foreground">{winner.team}</p>
        <p className="text-sm text-muted-foreground mb-4">{winner.school}</p>
        <div className="inline-block px-4 py-1 bg-white rounded-lg text-sm font-bold shadow-sm border border-border">
          {winner.score} 点
        </div>
      </CardContent>
    </Card>
  );
}
