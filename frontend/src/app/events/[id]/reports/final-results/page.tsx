"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import { fetchStandings, fetchMatchSummary, fetchMatches, saveFinalStandings, StandingsEntry, MatchSummary } from "@/lib/matchApi";
import { fetchSchools, fetchTeams, fetchSections, fetchTimetableSegments, Section, TimetableSegment } from "@/lib/masterApi";
import MatchResultExport from "@/components/pages/events/reports/MatchResultExport";
import TournamentTree from "@/components/pages/events/reports/TournamentTree";

// ── メダルアイコン ─────────────────────────────────────────────────────────────
function MedalIcon({ rank }: { rank: number }) {
  const colors = ["text-yellow-400", "text-gray-400", "text-amber-600"];
  if (rank > 3) return null;
  return (
    <div className="relative">
      <Icon name="emoji_events" size={rank === 1 ? 56 : 44} className={colors[rank - 1]} />
    </div>
  );
}

// ── タイ解消モーダル ──────────────────────────────────────────────────────────
interface TieGroup {
  sectionId: number | null;
  sectionName: string | null;
  rank: number;
  teams: StandingsEntry[];
}

interface TieResolveModalProps {
  tieGroups: TieGroup[];
  onResolve: (resolved: Map<number, number>) => void; // teamId -> finalRank
  onCancel: () => void;
}

function TieResolveModal({ tieGroups, onResolve, onCancel }: TieResolveModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [skippedGroups, setSkippedGroups] = useState<Set<number>>(() => new Set());
  const [orders, setOrders] = useState<Map<number, StandingsEntry[]>>(
    () => new Map(tieGroups.map((g, i) => [i, [...g.teams]]))
  );

  if (tieGroups.length === 0) return null;

  const current = tieGroups[currentIndex];
  const currentOrder = orders.get(currentIndex) ?? current.teams;

  function moveUp(teamId: number) {
    setOrders((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(currentIndex) ?? current.teams)];
      const idx = arr.findIndex((t) => t.team_id === teamId);
      if (idx > 0) {
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      }
      next.set(currentIndex, arr);
      return next;
    });
  }

  function moveDown(teamId: number) {
    setOrders((prev) => {
      const next = new Map(prev);
      const arr = [...(next.get(currentIndex) ?? current.teams)];
      const idx = arr.findIndex((t) => t.team_id === teamId);
      if (idx < arr.length - 1) {
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      }
      next.set(currentIndex, arr);
      return next;
    });
  }

  function submitResolve(skipped: Set<number>) {
    const resolved = new Map<number, number>();
    tieGroups.forEach((group, idx) => {
      if (skipped.has(idx)) {
        // Skipped: keep the tie rank for all teams in this group
        group.teams.forEach((team) => {
          resolved.set(team.team_id, group.rank);
        });
      } else {
        const ordered = orders.get(idx) ?? group.teams;
        ordered.forEach((team, pos) => {
          resolved.set(team.team_id, group.rank + pos);
        });
      }
    });
    onResolve(resolved);
  }

  function handleNext() {
    if (currentIndex < tieGroups.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      submitResolve(skippedGroups);
    }
  }

  function handleSkip() {
    const nextSkipped = new Set(skippedGroups);
    nextSkipped.add(currentIndex);
    setSkippedGroups(nextSkipped);

    if (currentIndex < tieGroups.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      submitResolve(nextSkipped);
    }
  }

  const isLast = currentIndex === tieGroups.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-5 relative">
        {/* Cancel Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name="close" size={20} />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-8">
          <div className="p-2 rounded-full bg-amber-100 shrink-0">
            <Icon name="warning" size={24} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">順位の重複があります</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {tieGroups.length > 1 && (
                <span className="text-primary font-medium">({currentIndex + 1}/{tieGroups.length}) </span>
              )}
              <span className="font-semibold">{current.sectionName ?? "全体"}</span> の{" "}
              <span className="font-bold text-amber-600">{current.rank}位</span>{" "}
              に複数のチームが並んでいます。
            </p>
          </div>
        </div>

        {/* 説明 */}
        <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          以下のリストでチームの最終順位を確定してください。
          上のチームが上位になります。↑↓ボタンで順序を変更できます。
        </p>

        {/* 順序リスト */}
        <div className="space-y-2">
          {currentOrder.map((team, pos) => (
            <div
              key={team.team_id}
              className="flex items-center gap-3 bg-white border border-border rounded-xl p-3 shadow-sm"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0">
                {current.rank + pos}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{team.team_name}</p>
                {team.school_name && (
                  <p className="text-xs text-muted-foreground truncate">{team.school_name}</p>
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => moveUp(team.team_id)}
                  disabled={pos === 0}
                  className="p-1 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Icon name="keyboard_arrow_up" size={18} />
                </button>
                <button
                  onClick={() => moveDown(team.team_id)}
                  disabled={pos === currentOrder.length - 1}
                  className="p-1 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed"
                >
                  <Icon name="keyboard_arrow_down" size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <Button className="flex-1" onClick={handleNext}>
            {isLast ? "順位を確定する" : "次へ"}
          </Button>
          <Button variant="outlined" onClick={handleSkip}>
            スキップ（タイのまま）
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────
export default function FinalResultsPage() {
  const params = useParams();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [resolvedRanks, setResolvedRanks] = useState<Map<number, number>>(new Map());
  const [showTieModal, setShowTieModal] = useState(false);
  const [tieGroups, setTieGroups] = useState<TieGroup[]>([]);

  const [summary, setSummary] = useState<MatchSummary>({ total: 0, confirmed: 0, scheduled: 0 });
  const [allMatches, setAllMatches] = useState<ReturnType<typeof fetchMatches> extends Promise<infer T> ? T : never>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [segments, setSegments] = useState<TimetableSegment[]>([]);
  const [teamCount, setTeamCount] = useState(0);
  const [schoolCount, setSchoolCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // 表示タブ: standings | export | tournament
  const [activeTab, setActiveTab] = useState<"standings" | "export" | "tournament">("standings");

  // エクスポート中状態
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const [standingsData, summaryData, matchesData, teamsData, schoolsData, sectionsData, segmentsData] =
        await Promise.all([
          fetchStandings(eventId, "pre"),
          fetchMatchSummary(eventId),
          fetchMatches(eventId),
          fetchTeams(eventId),
          fetchSchools(eventId),
          fetchSections(eventId),
          fetchTimetableSegments(eventId),
        ]);
      setStandings(standingsData);
      setSummary(summaryData);
      setAllMatches(matchesData);
      setTeamCount(teamsData.length);
      setSchoolCount(schoolsData.length);
      setSections(sectionsData);
      setSegments(segmentsData);

      // DBから取得した確定順位（final_rank）を resolvedRanks に反映
      const initialResolved = new Map<number, number>();
      let hasSavedFinalRank = false;
      standingsData.forEach((s) => {
        if (s.final_rank != null) {
          initialResolved.set(s.team_id, s.final_rank);
          hasSavedFinalRank = true;
        }
      });
      setResolvedRanks(initialResolved);

      // まだ一度も手動確定（タイ解消）がDB保存されていない場合のみ、自動でタイ解消ダイアログを表示
      if (!hasSavedFinalRank) {
        detectTies(standingsData);
      }
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  function detectTies(data: StandingsEntry[]) {
    // 部門・順位でグループ化してタイを検出
    const groups = new Map<string, StandingsEntry[]>();
    data.forEach((entry) => {
      const key = `${entry.event_section_id ?? "null"}_${entry.rank}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    });

    const tieList: TieGroup[] = [];
    groups.forEach((entries, key) => {
      if (entries.length >= 2) {
        tieList.push({
          sectionId: entries[0].event_section_id,
          sectionName: entries[0].section_name,
          rank: entries[0].rank,
          teams: entries,
        });
      }
    });

    // 重要度の高い順（1位タイ > 2位タイ > ...）にソート
    tieList.sort((a, b) => a.rank - b.rank);

    if (tieList.length > 0) {
      setTieGroups(tieList);
      setShowTieModal(true);
    }
  }

  async function handleTieResolve(resolved: Map<number, number>) {
    setResolvedRanks(resolved);
    setShowTieModal(false);

    if (!eventId) return;
    try {
      const payload = Array.from(resolved.entries()).map(([team_id, final_rank]) => ({
        team_id,
        final_rank,
      }));
      await saveFinalStandings(eventId, payload);
    } catch (e) {
      alert("順位の保存に失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"));
    }
  }

  async function handleResetFinalRanks() {
    if (!eventId) return;
    if (!confirm("手動で解消した順位設定をすべてリセット（タイの状態に戻す）してもよろしいですか？")) {
      return;
    }
    try {
      setLoading(true);
      await saveFinalStandings(eventId, []);
      setResolvedRanks(new Map());
      await load();
    } catch (e) {
      alert("リセットに失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"));
    } finally {
      setLoading(false);
    }
  }

  // 最終的な順位を取得（resolvedRanks で上書き）
  function getEffectiveRank(entry: StandingsEntry): number {
    return resolvedRanks.get(entry.team_id) ?? entry.rank;
  }

  // FileSaver.js 互換のダウンロードヘルパー
  // dispatchEvent + 長めのURL保持で Chrome の download 属性無視を回避
  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    // dispatchEvent の方が .click() より信頼性が高い
    try {
      a.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    } catch {
      a.click();
    }
    // 40秒間 URL を保持（FileSaver.js と同じ戦略）
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 40000);
  }

  // エクスポート処理
  async function handleExport(format: "png" | "jpeg" | "pdf") {
    const root = document.getElementById("match-result-export-root");
    if (!root) return;
    setExporting(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const rawCanvas = await html2canvas(root, { scale: 2, useCORS: true, backgroundColor: "#fff" });

      // 横幅を1024px相当に固定するリサイズ
      const targetWidth = 1024;
      const targetHeight = Math.round((rawCanvas.height * targetWidth) / rawCanvas.width);

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(rawCanvas, 0, 0, targetWidth, targetHeight);
      }

      if (format === "pdf") {
        const { jsPDF } = await import("jspdf");
        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const pdf = new jsPDF({
          orientation: targetWidth > targetHeight ? "landscape" : "portrait",
          unit: "px",
          format: [targetWidth, targetHeight],
        });
        pdf.addImage(imgData, "JPEG", 0, 0, targetWidth, targetHeight);
        const blob = pdf.output("blob");
        downloadBlob(blob, `match-results-${eventId}.pdf`);
      } else {
        const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
        const ext = format;
        const filename = `match-results-${eventId}.${ext}`;
        await new Promise<void>((resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error("toBlob が失敗しました")); return; }
              downloadBlob(blob, filename);
              resolve();
            },
            mimeType,
            0.95
          );
        });
      }
    } catch (e) {
      alert("エクスポートに失敗しました: " + (e instanceof Error ? e.message : "不明なエラー"));
    } finally {
      setExporting(false);
    }
  }

  // CSV エクスポート
  const handleCSVExport = () => {
    const rows = [
      ["部門", "順位（確定）", "チーム名", "学校", "勝", "負", "コミュ合計"],
      ...standings.map((s) => [
        s.section_name ?? "全体",
        getEffectiveRank(s),
        s.team_name,
        s.school_name ?? "",
        s.wins,
        s.losses,
        s.total_comm,
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, `final-results-${eventId}.csv`);
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
  const sectionMap = new Map(sections.map((s, i) => [s.id, { section: s, index: i }]));

  // 部門ごとにグループ化
  const sectionGroups = Array.from(
    new Map(standings.map((s) => [s.event_section_id, s.section_name])).entries()
  ).map(([id, name]) => ({ id, name }));

  // 本戦試合（is_pre_round=false セグメントに属する試合）
  const mainRoundSegmentIds = new Set(
    segments.filter((s) => !s.is_pre_round).map((s) => s.id)
  );
  const mainRoundMatches = allMatches.filter(
    (m) => m.event_timetable_segment_id != null && mainRoundSegmentIds.has(m.event_timetable_segment_id)
  );

  return (
    <>
      {/* タイ解消モーダル */}
      {showTieModal && tieGroups.length > 0 && (
        <TieResolveModal
          tieGroups={tieGroups}
          onResolve={handleTieResolve}
          onCancel={() => setShowTieModal(false)}
        />
      )}

      <div className="space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">大会最終結果</h1>
            <p className="text-muted-foreground mt-1">
              {allConfirmed
                ? "全日程が終了しました。各部門の最終順位と統計情報です。"
                : "現在の確定済み結果に基づく速報順位です。"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {resolvedRanks.size > 0 && (
              <div className="flex items-center gap-1.5">
                <Badge variant="success" className="text-xs px-3 py-1.5 font-medium">
                  <Icon name="check_circle" size={14} className="mr-1" />
                  タイ解消済み
                </Badge>
                <Button
                  variant="outlined"
                  size="sm"
                  icon="restart_alt"
                  onClick={handleResetFinalRanks}
                  className="text-destructive hover:bg-destructive/5 border-destructive/30 hover:border-destructive/50"
                >
                  タイ解消をリセット
                </Button>
              </div>
            )}
            {tieGroups.length > 0 && (
              <Button
                variant="outlined"
                size="sm"
                icon="low_priority"
                onClick={() => setShowTieModal(true)}
              >
                順位タイを解消する
              </Button>
            )}
            <Button variant="outlined" icon="download" onClick={handleCSVExport}>CSVエクスポート</Button>
          </div>
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

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-muted/30 rounded-xl w-fit border border-border">
          {([
            { key: "standings", label: "予選順位", icon: "bar_chart" },
            { key: "export", label: "試合結果出力", icon: "picture_as_pdf" },
            { key: "tournament", label: "決勝トーナメント", icon: "account_tree" },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === key
                  ? "bg-white text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon name={icon} size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Tab: 予選順位 */}
        {activeTab === "standings" && (
          <div className="space-y-6">
            {standings.length === 0 ? (
              <div className="py-20 bg-muted/20 rounded-2xl border border-dashed border-border text-center">
                <Icon name="emoji_events" size={56} className="text-muted-foreground opacity-20 mx-auto" />
                <p className="text-muted-foreground font-medium mt-4">結果はまだ確定していません</p>
                <p className="text-xs text-muted-foreground mt-2">試合結果を入力・確定すると自動的に集計されます</p>
              </div>
            ) : (
              sectionGroups.map(({ id, name }) => {
                const sectionStandings = standings
                  .filter((s) => s.event_section_id === id)
                  .map((s) => ({ ...s, effectiveRank: getEffectiveRank(s) }))
                  .sort((a, b) => a.effectiveRank - b.effectiveRank);

                return (
                  <div key={id} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold">{name}</h2>
                      <Badge variant="outline" className="border-primary/30 text-primary">
                        {sectionStandings.length}チーム
                      </Badge>
                    </div>

                    {sectionStandings.length > 0 && (
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
                            {sectionStandings.map((s) => (
                              <tr key={s.team_id} className="border-t border-border hover:bg-muted/30 transition-colors">
                                <td className="text-center px-4 py-3 text-muted-foreground font-medium">{s.effectiveRank}</td>
                                <td className="px-4 py-3 font-medium">{s.team_name}</td>
                                <td className="px-4 py-3 text-muted-foreground">{s.school_name ?? "-"}</td>
                                <td className="text-center px-4 py-3">
                                  <Badge variant="success" className="text-xs">{s.wins}</Badge>
                                </td>
                                <td className="text-center px-4 py-3">
                                  <Badge variant="destructive" className="text-xs">{s.losses}</Badge>
                                </td>
                                <td className="text-center px-4 py-3 font-bold text-primary">{s.total_comm}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Tab: 試合結果出力 */}
        {activeTab === "export" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground flex-1">
                以下のプレビューを PNG / JPEG / PDF 形式でダウンロードできます。
              </p>
              <div className="flex gap-2 flex-wrap">
                {(["png", "jpeg", "pdf"] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    variant="outlined"
                    size="sm"
                    loading={exporting}
                    onClick={() => handleExport(fmt)}
                    icon={fmt === "pdf" ? "picture_as_pdf" : "image"}
                  >
                    {fmt.toUpperCase()} で保存
                  </Button>
                ))}
              </div>
            </div>

            {/* Export Preview */}
            <div className="border border-border rounded-xl overflow-auto bg-gray-50 p-4">
              <MatchResultExport
                matches={allMatches}
                segments={segments}
                sections={sections}
                rooms={[]}
              />
            </div>
          </div>
        )}

        {/* Tab: 決勝トーナメント */}
        {activeTab === "tournament" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm">
              <Icon name="info" size={18} />
              <p>
                「予選」フラグが OFF のタイムテーブルセグメントに属する試合が表示されます。
              </p>
            </div>
            <TournamentTree
              matches={mainRoundMatches}
            />
          </div>
        )}
      </div>
    </>
  );
}
