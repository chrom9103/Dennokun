"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { fetchStandings, fetchMatchSummary, StandingsEntry, MatchSummary } from "@/lib/matchApi";

function TrophyIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Icon name="emoji_events" size={20} className="text-yellow-500" />;
  if (rank === 2) return <Icon name="emoji_events" size={20} className="text-gray-400" />;
  if (rank === 3) return <Icon name="emoji_events" size={20} className="text-amber-600" />;
  return null;
}

const labelMap = {
  wins: "勝ち数",
  total_votes: "得票数",
  total_comm: "コミュ合計",
};

type SortKey = keyof typeof labelMap;

export default function StandingsPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [summary, setSummary] = useState<MatchSummary>({ total: 0, confirmed: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<number | null>(null);

  // Sorting priority state: default is Wins -> Votes -> Comm
  const [sortPriority, setSortPriority] = useState<SortKey[]>([
    "wins",
    "total_votes",
    "total_comm",
  ]);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [standingsData, summaryData] = await Promise.all([
        fetchStandings(eventId, "pre"),
        fetchMatchSummary(eventId, "pre"),
      ]);
      setStandings(standingsData);
      setSummary(summaryData);
      // Default to first section
      if (standingsData.length > 0 && activeSection === null) {
        setActiveSection(standingsData[0].event_section_id ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // Get unique sections
  const sections = Array.from(
    new Map(standings.map((s) => [s.event_section_id, s.section_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  const filteredStandings = activeSection !== null
    ? standings.filter((s) => s.event_section_id === activeSection)
    : standings;

  // Handle reordering of sorting priority
  const movePriority = (index: number, direction: "up" | "down") => {
    const newPriority = [...sortPriority];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx >= 0 && targetIdx < newPriority.length) {
      const temp = newPriority[index];
      newPriority[index] = newPriority[targetIdx];
      newPriority[targetIdx] = temp;
      setSortPriority(newPriority);
    }
  };

  // Re-calculate sorted and ranked standings based on current priority
  const getSortedAndRankedStandings = useCallback((entries: StandingsEntry[], priority: SortKey[]) => {
    const sorted = [...entries].sort((a, b) => {
      for (const key of priority) {
        const valA = a[key] ?? 0;
        const valB = b[key] ?? 0;
        if (valA !== valB) {
          return valB - valA; // Descending
        }
      }
      return 0;
    });

    let currentRank = 1;
    let tieCount = 0;

    return sorted.map((entry, idx) => {
      if (idx > 0) {
        const prev = sorted[idx - 1];
        let isTie = true;
        for (const key of priority) {
          if ((entry[key] ?? 0) !== (prev[key] ?? 0)) {
            isTie = false;
            break;
          }
        }
        if (isTie) {
          tieCount++;
        } else {
          currentRank += tieCount + 1;
          tieCount = 0;
        }
      }
      return { ...entry, rank: currentRank };
    });
  }, []);

  const sortedAndRanked = getSortedAndRankedStandings(filteredStandings, sortPriority);

  const handleExport = () => {
    const rows = [
      ["順位", "チーム名", "学校", "試合数", "勝", "負", "得票数", "コミュ合計"],
      ...sortedAndRanked.map((s) => [
        s.rank, s.team_name, s.school_name ?? "", s.matches_played, s.wins, s.losses,
        s.total_votes, s.total_comm,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pre_round_standings_${eventId}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">予選順位表</h1>
          <p className="text-sm text-muted-foreground mt-1">
            現在の予選の対戦結果に基づいたリアルタイムの順位を表示します。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" size="sm" icon="refresh" onClick={load}>更新</Button>
          <Button variant="outlined" icon="download" onClick={handleExport}>CSVエクスポート</Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* Summary stats & Priority Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 items-stretch">
        <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm h-full">
          <div className="p-2 rounded-lg bg-info-light/40"><Icon name="groups" size={24} className="text-primary" /></div>
          <div>
            <p className="text-xs text-muted-foreground">参加チーム</p>
            <p className="text-xl font-bold">{standings.length} チーム</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm h-full">
          <div className="p-2 rounded-lg bg-green-50"><Icon name="check_circle" size={24} className="text-green-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">完了済み試合</p>
            <p className="text-xl font-bold">{summary.confirmed} / {summary.total}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm h-full">
          <div className="p-2 rounded-lg bg-amber-50"><Icon name="pending_actions" size={24} className="text-amber-600" /></div>
          <div>
            <p className="text-xs text-muted-foreground">残り試合数</p>
            <p className="text-xl font-bold">{summary.total - summary.confirmed} 試合</p>
          </div>
        </div>
        
        {/* Sorting priority configuration card */}
        <Card className="h-full shadow-sm flex flex-col justify-between">
          <div className="px-4 pt-3 pb-2 border-b border-border/50">
            <div className="flex items-center gap-2">
              <Icon name="tune" size={16} className="text-primary" />
              <h3 className="font-bold text-xs text-foreground">順位決定の優先度</h3>
            </div>
          </div>
          <div className="px-4 py-3 flex-1 flex flex-col justify-between gap-3">
            <div className="space-y-1.5">
              {sortPriority.map((key, idx) => {
                const label = labelMap[key];
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between p-1.5 rounded-lg border border-border bg-slate-50/50 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold font-mono">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-foreground">{label}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => movePriority(idx, "up")}
                        disabled={idx === 0}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="優先度を上げる"
                      >
                        <Icon name="arrow_upward" size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => movePriority(idx, "down")}
                        disabled={idx === sortPriority.length - 1}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors"
                        title="優先度を下げる"
                      >
                        <Icon name="arrow_downward" size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              variant="outlined"
              size="sm"
              className="w-full text-[10px] font-semibold py-1"
              onClick={() => setSortPriority(["wins", "total_votes", "total_comm"])}
            >
              デフォルトに戻す
            </Button>
          </div>
        </Card>
      </div>

      {/* Standings table */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50">
          {/* Section tabs */}
          <div className="flex gap-2 flex-wrap">
            {sections.length > 1 && sections.map(({ id, name }) => (
              <button
                key={id}
                onClick={() => setActiveSection(id)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${
                  activeSection === id
                    ? "bg-primary text-white border-primary"
                    : "border-border text-muted-foreground hover:border-primary"
                }`}
              >
                {name}
              </button>
            ))}
            {sections.length === 0 && !loading && (
              <p className="text-sm text-muted-foreground">部門なし</p>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium bg-secondary/50 px-2.5 py-1 rounded-full border border-border/50">
            <Icon name="info" size={13} className="text-muted-foreground/80" />
            <span>優先順: {sortPriority.map((k) => labelMap[k]).join(" → ")}</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead align="center" className="w-16">順位</TableHead>
                <TableHead>チーム名</TableHead>
                <TableHead>学校</TableHead>
                <TableHead align="center">試合数</TableHead>
                <TableHead align="center">勝</TableHead>
                <TableHead align="center">負</TableHead>
                <TableHead align="center">得票数</TableHead>
                <TableHead align="center">勝率</TableHead>
                <TableHead align="center">コミュ合計</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow hover={false}>
                  <TableCell colSpan={9} className="py-20 text-center text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      読み込み中...
                    </span>
                  </TableCell>
                </TableRow>
              ) : sortedAndRanked.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={9} className="py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="analytics" size={40} className="opacity-20" />
                      <p>試合結果がまだ確定していません</p>
                      <p className="text-xs">結果を「確定保存」すると順位が表示されます</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedAndRanked.map((s) => {
                  const winRate = s.matches_played > 0 ? ((s.wins / s.matches_played) * 100).toFixed(1) : "0.0";
                  const isTop3 = s.rank <= 3;
                  return (
                    <TableRow key={`${s.event_section_id}-${s.team_id}`}
                      className={isTop3 ? "bg-gradient-to-r from-yellow-50/60 to-transparent" : ""}
                    >
                      <TableCell align="center">
                        <div className="flex items-center justify-center gap-1.5">
                          <TrophyIcon rank={s.rank} />
                          <span className={`text-lg font-bold ${isTop3 ? "text-primary" : "text-muted-foreground"}`}>
                            {s.rank}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-foreground">{s.team_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.school_name ?? "-"}</TableCell>
                      <TableCell align="center" className="font-mono text-foreground">{s.matches_played}</TableCell>
                      <TableCell align="center">
                        <Badge variant="success" className="text-xs font-bold">{s.wins}</Badge>
                      </TableCell>
                      <TableCell align="center">
                        <Badge variant="destructive" className="text-xs font-bold">{s.losses}</Badge>
                      </TableCell>
                      <TableCell align="center" className="font-bold text-foreground font-mono">{s.total_votes}</TableCell>
                      <TableCell align="center" className="font-mono text-muted-foreground">{winRate}%</TableCell>
                      <TableCell align="center" className="font-bold text-primary font-mono">{s.total_comm}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
