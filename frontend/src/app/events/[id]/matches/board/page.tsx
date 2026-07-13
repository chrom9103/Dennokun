"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { fetchMatches, fetchMatchSummary, MatchListItem, MatchSummary } from "@/lib/matchApi";
import { fetchSections, Section } from "@/lib/masterApi";
import { getSectionColorById } from "@/lib/sectionColors";

function StatusBadge({ confirmed, hasTeams }: { confirmed: boolean; hasTeams: boolean }) {
  if (!hasTeams) return <Badge variant="outline" className="text-[10px]">未割当</Badge>;
  if (confirmed) return <Badge variant="success" className="text-[10px]">確定済</Badge>;
  return <Badge variant="warning" className="text-[10px]">未入力</Badge>;
}

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [summary, setSummary] = useState<MatchSummary>({ total: 0, confirmed: 0, scheduled: 0 });
  const [sectionList, setSectionList] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fSegment, setFSegment] = useState("all");
  const [fSection, setFSection] = useState("all");
  const [fStatus, setFStatus] = useState("all");

  useEffect(() => {
    const savedSegment = sessionStorage.getItem("board_filter_segment");
    const savedSection = sessionStorage.getItem("board_filter_section");
    const savedStatus = sessionStorage.getItem("board_filter_status");
    if (savedSegment) setFSegment(savedSegment);
    if (savedSection) setFSection(savedSection);
    if (savedStatus) setFStatus(savedStatus);
  }, []);

  const handleSegmentChange = (val: string) => {
    setFSegment(val);
    sessionStorage.setItem("board_filter_segment", val);
  };

  const handleSectionChange = (val: string) => {
    setFSection(val);
    sessionStorage.setItem("board_filter_section", val);
  };

  const handleStatusChange = (val: string) => {
    setFStatus(val);
    sessionStorage.setItem("board_filter_status", val);
  };

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [matchesData, summaryData, sectionsData] = await Promise.all([
        fetchMatches(eventId),
        fetchMatchSummary(eventId),
        fetchSections(eventId),
      ]);
      setMatches(matchesData);
      setSummary(summaryData);
      setSectionList(sectionsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  // Get unique segments and sections from matches
  const segments = Array.from(new Map(
    matches.filter((m) => m.timetable_segment_name).map((m) => [m.event_timetable_segment_id, m.timetable_segment_name])
  ).entries()).map(([id, name]) => ({ id, name }));

  const sections = Array.from(new Map(
    matches.filter((m) => m.section_name).map((m) => [m.event_section_id, m.section_name])
  ).entries()).map(([id, name]) => ({ id, name }));

  const filtered = matches.filter((m) => {
    const hasTeams = !!(m.aff_team_id && m.neg_team_id);
    const status = !hasTeams ? "unassigned" : m.is_result_confirmed ? "confirmed" : "pending";
    const matchSeg = fSegment === "all" || String(m.event_timetable_segment_id) === fSegment;
    const matchSec = fSection === "all" || String(m.event_section_id) === fSection;
    const matchStat = fStatus === "all" || fStatus === status;
    return matchSeg && matchSec && matchStat;
  });

  const pendingCount = matches.filter((m) => m.aff_team_id && m.neg_team_id && !m.is_result_confirmed).length;

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">進行ボード</h1>
          <p className="text-sm text-muted-foreground mt-1">
            大会全体の進行状況をリアルタイムで確認できます。
          </p>
        </div>
        <Button variant="outlined" icon="refresh" size="sm" onClick={load}>更新</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "総試合数", value: summary.total, icon: "sports", color: "text-primary bg-info-light/40" },
          { label: "確定済み", value: summary.confirmed, icon: "check_circle", color: "text-green-700 bg-green-50" },
          { label: "入力待ち", value: pendingCount, icon: "pending_actions", color: "text-amber-700 bg-amber-50" },
          { label: "未完了", value: summary.total - summary.confirmed, icon: "hourglass_empty", color: "text-gray-600 bg-gray-50" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm">
            <div className={`p-2 rounded-lg ${color.split(" ")[1]}`}>
              <Icon name={icon} size={22} className={color.split(" ")[0]} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-wrap gap-3">
          <select value={fSegment} onChange={(e) => handleSegmentChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none">
            <option value="all">すべての時間枠</option>
            {segments.map(({ id, name }) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
          <select value={fSection} onChange={(e) => handleSectionChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none">
            <option value="all">すべての部門</option>
            {sections.map(({ id, name }) => (
              <option key={id} value={String(id)}>{name}</option>
            ))}
          </select>
          <select value={fStatus} onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-white text-sm focus:ring-2 focus:ring-primary focus:outline-none">
            <option value="all">すべてのステータス</option>
            <option value="confirmed">確定済み</option>
            <option value="pending">入力待ち</option>
            <option value="unassigned">未割当</option>
          </select>
        </CardHeader>

        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>時間枠</TableHead>
                <TableHead>会場</TableHead>
                <TableHead>部門</TableHead>
                <TableHead>肯定側（Aff）</TableHead>
                <TableHead align="center">VS</TableHead>
                <TableHead>否定側（Neg）</TableHead>
                <TableHead align="center">結果</TableHead>
                <TableHead align="center">状態</TableHead>
                <TableHead align="center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow hover={false}>
                  <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      読み込み中...
                    </span>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={9} className="py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="sports" size={40} className="opacity-20" />
                      <p>試合が登録されていません</p>
                      <p className="text-xs">マッチング生成後にここに表示されます</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((m) => {
                  const hasTeams = !!(m.aff_team_id && m.neg_team_id);
                  const affWon = m.is_result_confirmed && m.aff_won === 1;
                  const negWon = m.is_result_confirmed && m.neg_won === 1;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm font-medium">{m.timetable_segment_name ?? "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.room_name ?? "-"}</TableCell>
                      <TableCell>
                        {m.section_name && (() => {
                          const color = getSectionColorById(m.event_section_id, sectionList);
                          return (
                            <span
                              style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold"
                            >
                              {m.section_name}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${affWon ? "text-primary" : ""}`}>
                          {m.aff_team_name ?? <span className="text-muted-foreground text-xs italic">未割当</span>}
                        </span>
                        {affWon && <Badge variant="success" className="ml-2 text-[10px]">勝</Badge>}
                      </TableCell>
                      <TableCell align="center">
                        <span className="text-muted-foreground font-bold">VS</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-medium ${negWon ? "text-pink-600" : ""}`}>
                          {m.neg_team_name ?? <span className="text-muted-foreground text-xs italic">未割当</span>}
                        </span>
                        {negWon && <Badge variant="success" className="ml-2 text-[10px]">勝</Badge>}
                      </TableCell>
                      <TableCell align="center">
                        {m.is_result_confirmed && (
                          <span className="text-sm font-mono font-bold">
                            {m.aff_votes ?? 0} - {m.neg_votes ?? 0}
                          </span>
                        )}
                      </TableCell>
                      <TableCell align="center">
                        <StatusBadge confirmed={m.is_result_confirmed} hasTeams={hasTeams} />
                      </TableCell>
                      <TableCell align="right">
                        {hasTeams && (
                          <Button
                            variant={m.is_result_confirmed ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => router.push(`/events/${eventId}/matches/${m.id}/edit`)}
                          >
                            <Icon name={m.is_result_confirmed ? "edit" : "how_to_vote"} size={16} />
                            <span className="ml-1">{m.is_result_confirmed ? "修正" : "入力"}</span>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">{filtered.length}件の試合を表示中</p>
    </div>
  );
}
