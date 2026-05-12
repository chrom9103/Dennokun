"use client";

import Button from "@/components/ui/Button";
import ChampionCard from "@/components/pages/events/reports/final-results/ChampionCard";
import RunnerUpCard from "@/components/pages/events/reports/final-results/RunnerUpCard";
import TournamentStats from "@/components/pages/events/reports/final-results/TournamentStats";

const winners: { rank: number; team: string; school: string; score: number }[] = [];

const stats = [
  { label: "参加校数", value: "0" },
  { label: "参加チーム数", value: "0" },
  { label: "総試合数", value: "0" },
  { label: "参加ジャッジ数", value: "0" },
];

export default function FinalResultsPage() {
  if (winners.length === 0) {
    return (
      <div className="space-y-8 pb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">大会最終結果</h1>
        <p className="text-muted-foreground mt-1">大会が終了すると、ここに最終順位が表示されます。</p>
        <div className="mt-12 py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
          <p className="text-muted-foreground font-medium">結果はまだ確定していません</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">大会最終結果</h1>
          <p className="text-muted-foreground mt-1">全日程が終了しました。各部門の最終順位と統計情報です。</p>
        </div>
        <Button variant="outlined" icon="download" size="lg">
          結果レポート出力
        </Button>
      </div>

      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Champion section */}
        <ChampionCard winner={winners[0]} />

        {/* Runner-ups section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {winners[1] && <RunnerUpCard winner={winners[1]} />}
          {winners[2] && <RunnerUpCard winner={winners[2]} />}
        </div>

        {/* Statistics section */}
        <TournamentStats stats={stats} />
      </div>
    </div>
  );
}
