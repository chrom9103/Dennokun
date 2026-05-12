"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import MatchBoardStats from "@/components/pages/events/matches/board/MatchBoardStats";
import MatchBoardTable from "@/components/pages/events/matches/board/MatchBoardTable";

interface Match {
  id: string; round: string; division: string; team1: string; team2: string;
  room: string; startTime: string; endTime: string; status: "scheduled" | "in-progress" | "completed";
  score1?: number; score2?: number;
}

const mockMatches: Match[] = [];

export default function BoardPage() {
  const [fRound, setFRound] = useState("all");
  const [fDiv, setFDiv] = useState("all");
  const [fStat, setFStat] = useState("all");

  const filtered = mockMatches.filter((m) =>
    (fRound === "all" || m.round === fRound) &&
    (fDiv === "all" || m.division === fDiv) &&
    (fStat === "all" || m.status === fStat)
  );

  const stats = {
    total: mockMatches.length,
    done: mockMatches.filter((m) => m.status === "completed").length,
    live: mockMatches.filter((m) => m.status === "in-progress").length,
    plan: mockMatches.filter((m) => m.status === "scheduled").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">進行ボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会全体の進行状況をリアルタイムで確認できます。
          </p>
        </div>
      </div>

      <MatchBoardStats stats={stats} />

      <Card>
        <CardHeader className="flex flex-wrap gap-3">
          <select 
            value={fRound} 
            onChange={(e) => setFRound(e.target.value)} 
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          >
            <option value="all">すべてのラウンド</option>
            <option value="予選第1試合">予選第1試合</option>
            <option value="本選">本選</option>
          </select>
          <select 
            value={fDiv} 
            onChange={(e) => setFDiv(e.target.value)} 
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          >
            <option value="all">すべての部門</option>
            <option value="高校生部門">高校生部門</option>
            <option value="中学生部門">中学生部門</option>
          </select>
          <select 
            value={fStat} 
            onChange={(e) => setFStat(e.target.value)} 
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
          >
            <option value="all">すべてのステータス</option>
            <option value="scheduled">予定</option>
            <option value="in-progress">進行中</option>
            <option value="completed">完了</option>
          </select>
        </CardHeader>
        
        <CardContent className="p-0">
          <MatchBoardTable matches={filtered} />
        </CardContent>
      </Card>
      
      <p className="text-xs text-muted-foreground">
        {filtered.length}件の試合を表示中
      </p>
    </div>
  );
}
