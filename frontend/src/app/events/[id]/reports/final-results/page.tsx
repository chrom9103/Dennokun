"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import { fetchStandings, fetchMatchSummary, StandingsEntry, MatchSummary } from "@/lib/matchApi";
import { fetchSchools, fetchTeams } from "@/lib/masterApi";

function MedalIcon({ rank }: { rank: number }) {
  const colors = ["text-yellow-400", "text-gray-400", "text-amber-600"];
  if (rank > 3) return null;
  return (
    <div className="relative">
      <Icon name="emoji_events" size={rank === 1 ? 56 : 44} className={colors[rank - 1]} />
    </div>
  );
}

export default function FinalResultsPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [summary, setSummary] = useState<MatchSummary>({ total: 0, confirmed: 0, scheduled: 0 });
  const [teamCount, setTeamCount] = useState(0);
  const [schoolCount, setSchoolCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [standingsData, summaryData, teamsData, schoolsData] = await Promise.all([
        fetchStandings(eventId),
        fetchMatchSummary(eventId),
        fetchTeams(eventId),
        fetchSchools(eventId),
      ]);
      setStandings(standingsData);
      setSummary(summaryData);
      setTeamCount(teamsData.length);
      setSchoolCount(schoolsData.length);
    } catch {
      // fail silently on this page
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // Group standings by section
  const sections = Array.from(
    new Map(standings.map((s) => [s.event_section_id, s.section_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  const handleExport = () => {
    const rows = [
      ["部門", "順位", "チーム名", "学校", "勝", "負", "コミュ合計"],
      ...standings.map((s) => [s.section_name ?? "全体", s.rank, s.team_name, s.school_name ?? "", s.wins, s.losses, s.total_comm]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `final-results-${eventId}.csv`;
    a.click();
  };

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const allConfirmed = summary.total > 0 && summary.confirmed === summary.total;

  if (standings.length === 0) {
    return (
      <div className="space-y-8 pb-12 text-center">
        <h1 className="text-3xl font-bold tracking-tight">大会最終結果</h1>
        <p className="text-muted-foreground">大会が終了すると、ここに最終順位が表示されます。</p>
        <div className="mt-12 py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
          <Icon name="emoji_events" size={56} className="text-muted-foreground opacity-20 mx-auto" />
          <p className="text-muted-foreground font-medium mt-4">結果はまだ確定していません</p>
          <p className="text-xs text-muted-foreground mt-2">
            試合結果を入力・確定すると自動的に集計されます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">大会最終結果</h1>
          <p className="text-muted-foreground mt-1">
            {allConfirmed ? "全日程が終了しました。各部門の最終順位と統計情報です。" : "現在の確定済み結果に基づく速報順位です。"}
          </p>
        </div>
        <Button variant="outlined" icon="download" onClick={handleExport}>結果レポート出力</Button>
      </div>

      {!allConfirmed && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <Icon name="warning" size={18} />
          <p>まだ確定していない試合があります（{summary.confirmed}/{summary.total}件確定）。これは速報順位です。</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "参加校数", value: `${schoolCount} 校`, icon: "school" },
          { label: "参加チーム数", value: `${teamCount} チーム`, icon: "groups" },
          { label: "総試合数", value: `${summary.total} 試合`, icon: "sports" },
          { label: "確定済み", value: `${summary.confirmed} 試合`, icon: "check_circle" },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4 text-center shadow-sm">
            <Icon name={icon} size={28} className="text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Results per section */}
      {sections.map(({ id, name }) => {
        const sectionStandings = standings.filter((s) => s.event_section_id === id);
        const top3 = sectionStandings.filter((s) => s.rank <= 3);
        const rest = sectionStandings.filter((s) => s.rank > 3);

        return (
          <div key={id} className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">{name}</h2>
              <Badge variant="outline" className="border-primary/30 text-primary">{sectionStandings.length}チーム</Badge>
            </div>

            {/* Top 3 podium */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((rank) => {
                const entry = top3.find((s) => s.rank === rank);
                if (!entry) return null;
                const bgColors = [
                  "bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-300",
                  "bg-gradient-to-br from-gray-50 to-gray-100 border-gray-300",
                  "bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200",
                ];
                return (
                  <div key={rank} className={`rounded-2xl border p-6 text-center ${bgColors[rank - 1]} ${rank === 1 ? "sm:order-2 shadow-lg" : rank === 2 ? "sm:order-1" : "sm:order-3"}`}>
                    <MedalIcon rank={rank} />
                    <p className="text-2xl font-bold mt-2">{entry.team_name}</p>
                    <p className="text-muted-foreground text-sm mt-1">{entry.school_name ?? ""}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                      <div className="bg-white/60 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">勝</p>
                        <p className="font-bold">{entry.wins}</p>
                      </div>
                      <div className="bg-white/60 rounded-lg p-2">
                        <p className="text-xs text-muted-foreground">コミュ計</p>
                        <p className="font-bold">{entry.total_comm}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 4位以下 */}
            {rest.length > 0 && (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="text-center px-4 py-3 w-16">順位</th>
                      <th className="text-left px-4 py-3">チーム名</th>
                      <th className="text-left px-4 py-3">学校</th>
                      <th className="text-center px-4 py-3">勝</th>
                      <th className="text-center px-4 py-3">負</th>
                      <th className="text-center px-4 py-3">コミュ合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rest.map((s) => (
                      <tr key={s.team_id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="text-center px-4 py-3 text-muted-foreground font-medium">{s.rank}</td>
                        <td className="px-4 py-3 font-medium">{s.team_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{s.school_name ?? "-"}</td>
                        <td className="text-center px-4 py-3"><Badge variant="success" className="text-xs">{s.wins}</Badge></td>
                        <td className="text-center px-4 py-3"><Badge variant="destructive" className="text-xs">{s.losses}</Badge></td>
                        <td className="text-center px-4 py-3 font-bold text-primary">{s.total_comm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
