"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { generateMatches, deleteAllMatches, updateMatchAssignment, GenerateMatchesRequest, assignJudges } from "@/lib/generateApi";
import { fetchMatches, fetchMatchSummary, MatchListItem, MatchSummary } from "@/lib/matchApi";
import { fetchTeams, fetchSections, fetchRooms, fetchTimetableSegments, fetchStaffs, Team, Section, Room, TimetableSegment, Staff } from "@/lib/masterApi";

// ── Generate options form ──────────────────────────────────────────────────────

interface GenForm {
  rounds: number;
  judges_per_match: number;
  assign_judges: boolean;
  assign_slots: boolean;
  overwrite: boolean;
}

// ── Edit assignment modal state ────────────────────────────────────────────────

interface EditForm {
  matchId: number;
  event_timetable_segment_id: string;
  event_room_id: string;
  aff_team_id: string;
  neg_team_id: string;
  main_judge_staff_id: string;
  sub_judge1_staff_id: string;
  sub_judge2_staff_id: string;
  timekeeper_staff_id: string;
}

export default function ControlPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const eventId = rawId ? parseInt(rawId as string) : null;

  // Master data
  const [teams, setTeams] = useState<Team[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [segments, setSegments] = useState<TimetableSegment[]>([]);
  const [staffs, setStaffs] = useState<Staff[]>([]);

  // Matches
  const [matches, setMatches] = useState<MatchListItem[]>([]);
  const [summary, setSummary] = useState<MatchSummary>({ total: 0, confirmed: 0, scheduled: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ generated_count: number; warnings: string[] } | null>(null);

  // Parallel matches per segment
  const [parallelMatches, setParallelMatches] = useState<Record<number, number>>({});
  // Judge counts per segment
  const [segmentJudgeCounts, setSegmentJudgeCounts] = useState<Record<number, number>>({});
  // Form options (overwrite, judges_per_match)
  const [genForm, setGenForm] = useState<GenForm>({
    rounds: 1,
    judges_per_match: 3,
    assign_judges: false,
    assign_slots: true,
    overwrite: false,
  });

  // Judge Assignment
  const [assigningJudges, setAssigningJudges] = useState(false);
  const [judgeResult, setJudgeResult] = useState<{ status: string; updated_count: number } | null>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit assignment modal
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Filters
  const [fSegment, setFSegment] = useState("all");
  const [fSection, setFSection] = useState("all");

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      setError(null);
      const [matchesData, summaryData, teamsData, sectionsData, roomsData, segsData, staffsData] = await Promise.all([
        fetchMatches(eventId),
        fetchMatchSummary(eventId),
        fetchTeams(eventId),
        fetchSections(eventId),
        fetchRooms(eventId),
        fetchTimetableSegments(eventId),
        fetchStaffs(eventId),
      ]);
      setMatches(matchesData);
      setSummary(summaryData);
      setTeams(teamsData);
      setSections(sectionsData);
      setRooms(roomsData);
      setSegments(segsData);
      setStaffs(staffsData);

      // Initialize parallel matches per segment if not set
      setParallelMatches((prev) => {
        const next = { ...prev };
        segsData.forEach((s) => {
          if (next[s.id] === undefined) {
            // デフォルトは会場数 roomsData.length の範囲内で2にするか、会場数が少なければそれに合わせる
            next[s.id] = Math.min(2, roomsData.length || 2);
          }
        });
        return next;
      });

      // Initialize judge counts per segment if not set
      setSegmentJudgeCounts((prev) => {
        const next = { ...prev };
        segsData.forEach((s) => {
          if (next[s.id] === undefined) {
            next[s.id] = 3; // デフォルトジャッジ数3
          }
        });
        return next;
      });


    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    const matchSeg = fSegment === "all" || String(m.event_timetable_segment_id) === fSegment;
    const matchSec = fSection === "all" || String(m.event_section_id) === fSection;
    return matchSeg && matchSec;
  });

  async function handleGenerate() {
    if (!eventId) return;
    if (genForm.overwrite && matches.length > 0) {
      if (!confirm(`既存の${matches.length}件の試合を削除してから再生成します。よろしいですか？`)) return;
    }
    setGenerating(true);
    setGenResult(null);
    setJudgeResult(null);
    setError(null);
    try {
      const req: GenerateMatchesRequest = {
        segment_parallel_matches: parallelMatches,
        overwrite: genForm.overwrite,
      };
      const result = await generateMatches(eventId, req);
      setGenResult({ generated_count: result.generated_count, warnings: result.warnings });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAssignJudges() {
    if (!eventId) return;
    if (matches.length === 0) {
      alert("割り当て対象の試合がありません。先に試合の組み合わせを生成してください。");
      return;
    }
    setAssigningJudges(true);
    setGenResult(null);
    setJudgeResult(null);
    setError(null);
    try {
      const result = await assignJudges(eventId, segmentJudgeCounts);
      setJudgeResult(result);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "審判の割り当てに失敗しました");
    } finally {
      setAssigningJudges(false);
    }
  }

  async function handleDeleteAll() {
    if (!eventId) return;
    setDeleting(true);
    try {
      await deleteAllMatches(eventId);
      setShowDeleteConfirm(false);
      setGenResult(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  function openEdit(m: MatchListItem) {
    setEditForm({
      matchId: m.id,
      event_timetable_segment_id: m.event_timetable_segment_id != null ? String(m.event_timetable_segment_id) : "",
      event_room_id: m.event_room_id != null ? String(m.event_room_id) : "",
      aff_team_id: m.aff_team_id != null ? String(m.aff_team_id) : "",
      neg_team_id: m.neg_team_id != null ? String(m.neg_team_id) : "",
      main_judge_staff_id: m.main_judge_staff_id != null ? String(m.main_judge_staff_id) : "",
      sub_judge1_staff_id: m.sub_judge1_staff_id != null ? String(m.sub_judge1_staff_id) : "",
      sub_judge2_staff_id: m.sub_judge2_staff_id != null ? String(m.sub_judge2_staff_id) : "",
      timekeeper_staff_id: m.timekeeper_staff_id != null ? String(m.timekeeper_staff_id) : "",
    });
  }

  async function handleSaveEdit() {
    if (!eventId || !editForm) return;
    setSavingEdit(true);
    try {
      const update: Record<string, number | null> = {};
      if (editForm.event_timetable_segment_id) update.event_timetable_segment_id = parseInt(editForm.event_timetable_segment_id);
      if (editForm.event_room_id) update.event_room_id = parseInt(editForm.event_room_id);
      if (editForm.aff_team_id) update.aff_team_id = parseInt(editForm.aff_team_id);
      if (editForm.neg_team_id) update.neg_team_id = parseInt(editForm.neg_team_id);
      if (editForm.main_judge_staff_id) update.main_judge_staff_id = parseInt(editForm.main_judge_staff_id);
      if (editForm.sub_judge1_staff_id) update.sub_judge1_staff_id = parseInt(editForm.sub_judge1_staff_id);
      if (editForm.sub_judge2_staff_id) update.sub_judge2_staff_id = parseInt(editForm.sub_judge2_staff_id);
      if (editForm.timekeeper_staff_id) update.timekeeper_staff_id = parseInt(editForm.timekeeper_staff_id);

      await updateMatchAssignment(eventId, editForm.matchId, update);
      setEditForm(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  }

  const judgeStaffs = staffs.filter((s) => s.can_be_main_judge || s.can_be_sub_judge);
  const uniqueSegments = Array.from(new Map(matches.filter((m) => m.timetable_segment_name).map((m) => [m.event_timetable_segment_id, m.timetable_segment_name])).entries());
  const uniqueSections = Array.from(new Map(matches.filter((m) => m.section_name).map((m) => [m.event_section_id, m.section_name])).entries());

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">組み合わせ制御</h1>
          <p className="text-sm text-muted-foreground mt-1">
            試合の対戦カード・ジャッジ・会場を自動生成または手動調整します。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" size="sm" icon="refresh" onClick={load}>更新</Button>
          {matches.length > 0 && (
            <Button variant="destructive" size="sm" icon="delete_sweep" onClick={() => setShowDeleteConfirm(true)}>
              全試合削除
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="error_outline" size={18} />
          <p>{error}</p>
        </div>
      )}

      {genResult && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <Icon name="check_circle" size={18} />
            {genResult.generated_count}件の試合を生成しました
          </p>
          {genResult.warnings.map((w, i) => (
            <p key={i} className="text-amber-700 flex items-center gap-1.5">
              <Icon name="warning" size={16} />
              {w}
            </p>
          ))}
        </div>
      )}

      {judgeResult && (
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
          <p className="font-semibold flex items-center gap-1.5">
            <Icon name="check_circle" size={18} />
            {judgeResult.updated_count}件の試合に審判を自動割り当てしました
          </p>
        </div>
      )}

      {/* Generation layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Match Generation Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10"><Icon name="sports" size={20} className="text-primary" /></div>
              <div>
                <h3 className="font-semibold">試合の組み合わせ生成</h3>
                <p className="text-xs text-muted-foreground">チームや時間枠情報から対戦ペアと会場スロットを自動生成します</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Parallel matches per segment input list */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block">各枠の並行試合数設定</label>
              <div className="border border-border rounded-xl p-3.5 space-y-3 bg-secondary/10">
                {segments.map((seg) => (
                  <div key={seg.id} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{seg.name}</p>
                      {seg.start_time && <p className="text-xs text-muted-foreground">{seg.start_time}開始</p>}
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setParallelMatches((prev) => ({ ...prev, [seg.id]: Math.max(0, (prev[seg.id] || 0) - 1) }))}
                        className="w-7 h-7 rounded-md bg-secondary hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={0}
                        max={rooms.length || 10}
                        value={parallelMatches[seg.id] ?? 0}
                        onChange={(e) => {
                          const val = Math.max(0, parseInt(e.target.value) || 0);
                          setParallelMatches((prev) => ({ ...prev, [seg.id]: val }));
                        }}
                        className="w-8 text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setParallelMatches((prev) => ({ ...prev, [seg.id]: Math.min(rooms.length || 10, (prev[seg.id] || 0) + 1) }))}
                        className="w-7 h-7 rounded-md bg-secondary hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2 border border-border rounded-lg p-3">
              <label className="flex items-start gap-3 cursor-pointer group hover:bg-muted/30 p-1.5 rounded-lg">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-primary rounded"
                  checked={genForm.overwrite} onChange={(e) => setGenForm((f) => ({ ...f, overwrite: e.target.checked }))} />
                <div>
                  <p className="text-sm font-medium text-destructive">既存試合を削除して再生成</p>
                  <p className="text-xs text-muted-foreground">現在の試合をすべて削除してから生成します</p>
                </div>
              </label>
            </div>

            {/* Match Generation chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: `${teams.length}チーム`, icon: "groups", ok: teams.length > 1 },
                { label: `${segments.length}時間枠`, icon: "schedule", ok: segments.length > 0 },
                { label: `${rooms.length}会場`, icon: "meeting_room", ok: rooms.length > 0 },
              ].map(({ label, icon, ok }) => (
                <span key={label} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${ok ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  <Icon name={ok ? "check_circle" : "warning"} size={13} />
                  {label}
                </span>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={handleGenerate}
              loading={generating}
              disabled={teams.length < 2}
            >
              <Icon name="auto_awesome" size={18} />
              <span className="ml-2">{generating ? "生成中..." : "試合の組み合わせを生成"}</span>
            </Button>
            {teams.length < 2 && (
              <p className="text-xs text-center text-muted-foreground">
                チームを2チーム以上登録すると生成できます
              </p>
            )}
          </CardContent>
        </Card>

        {/* Judge Assignment Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10"><Icon name="gavel" size={20} className="text-amber-600" /></div>
              <div>
                <h3 className="font-semibold">審判（ジャッジ）の自動割当</h3>
                <p className="text-xs text-muted-foreground">登録済みの試合に対して、利害関係を考慮し審判を自動で割り当てます</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Judge counts per segment input list */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider block">各枠の1試合あたりジャッジ数設定</label>
              <div className="border border-border rounded-xl p-3.5 space-y-3 bg-secondary/10">
                {segments.map((seg) => (
                  <div key={seg.id} className="flex items-center justify-between py-1 border-b border-border/40 last:border-0 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{seg.name}</p>
                      {seg.start_time && <p className="text-xs text-muted-foreground">{seg.start_time}開始</p>}
                    </div>
                    <div className="flex items-center gap-1 bg-white border border-border rounded-lg p-0.5 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setSegmentJudgeCounts((prev) => ({ ...prev, [seg.id]: Math.max(1, (prev[seg.id] || 3) - 1) }))}
                        className="w-7 h-7 rounded-md bg-secondary hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={segmentJudgeCounts[seg.id] ?? 3}
                        onChange={(e) => {
                          const val = Math.max(1, Math.min(5, parseInt(e.target.value) || 3));
                          setSegmentJudgeCounts((prev) => ({ ...prev, [seg.id]: val }));
                        }}
                        className="w-8 text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => setSegmentJudgeCounts((prev) => ({ ...prev, [seg.id]: Math.min(5, (prev[seg.id] || 3) + 1) }))}
                        className="w-7 h-7 rounded-md bg-secondary hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { label: `${matches.length}試合`, icon: "sports", ok: matches.length > 0 },
                { label: `${staffs.filter(s => s.can_be_main_judge || s.can_be_sub_judge).length}名のジャッジ資格スタッフ`, icon: "badge", ok: staffs.filter(s => s.can_be_main_judge || s.can_be_sub_judge).length > 0 },
              ].map(({ label, icon, ok }) => (
                <span key={label} className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${ok ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                  <Icon name={ok ? "check_circle" : "warning"} size={13} />
                  {label}
                </span>
              ))}
            </div>

            <Button
              className="w-full"
              onClick={handleAssignJudges}
              loading={assigningJudges}
              disabled={matches.length === 0 || staffs.filter(s => s.can_be_main_judge || s.can_be_sub_judge).length === 0}
            >
              <Icon name="auto_awesome" size={18} />
              <span className="ml-2">{assigningJudges ? "割り当て中..." : "審判の割り当てを自動生成"}</span>
            </Button>
            {matches.length === 0 && (
              <p className="text-xs text-center text-muted-foreground">
                先に試合の組み合わせを生成してください
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Match list */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 border border-border rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-lg text-foreground">生成済み試合一覧</h3>
            <Badge variant="secondary" className="px-2.5 py-0.5">{matches.length} 試合</Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={fSegment} onChange={(e) => setFSegment(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="all">すべての時間枠</option>
              {uniqueSegments.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
            </select>
            <select value={fSection} onChange={(e) => setFSection(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="all">すべての部門</option>
              {uniqueSections.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                読み込み中...
              </span>
            </CardContent>
          </Card>
        ) : filteredMatches.length === 0 ? (
          <Card>
            <CardContent className="py-20 text-center text-muted-foreground">
              <div className="flex flex-col items-center gap-2">
                <Icon name="sports_score" size={44} className="opacity-20" />
                <p className="font-medium text-sm">試合が生成されていません</p>
                <p className="text-xs">上の「試合の組み合わせ生成」ボタンで生成を開始してください</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          segments
            .map((seg) => {
              const segMatches = filteredMatches.filter((m) => m.event_timetable_segment_id === seg.id);
              return { seg, matches: segMatches };
            })
            .filter((item) => item.matches.length > 0)
            .map(({ seg, matches: segMatches }) => (
              <Card key={seg.id} className="overflow-hidden border-border/80 shadow-sm">
                <CardHeader className="bg-muted/30 border-b border-border/60 py-3 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1 rounded bg-secondary/80 text-muted-foreground"><Icon name="schedule" size={16} /></div>
                    <span className="font-bold text-sm text-foreground">{seg.name}</span>
                    {seg.start_time && (
                      <span className="text-xs text-muted-foreground bg-white px-2 py-0.5 border border-border rounded-full font-medium">
                        {seg.start_time}〜
                      </span>
                    )}
                  </div>
                  <Badge variant="outline" className="bg-white border-border/80 text-xs font-semibold">{segMatches.length} 試合</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <Table className="border-none rounded-none">
                    <TableHeader>
                      <TableRow hover={false}>
                        <TableHead className="pl-4">会場</TableHead>
                        <TableHead>部門</TableHead>
                        <TableHead>肯定側</TableHead>
                        <TableHead align="center" className="text-center w-12">VS</TableHead>
                        <TableHead>否定側</TableHead>
                        <TableHead>審判</TableHead>
                        <TableHead>司会タイマー</TableHead>
                        <TableHead align="center" className="text-center w-20">状態</TableHead>
                        <TableHead align="right" className="pr-4 text-right w-16">微調整</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segMatches.map((m) => {
                        const mainJudge = staffs.find((s) => s.id === (m as any).main_judge_staff_id);
                        const subJudge1 = staffs.find((s) => s.id === (m as any).sub_judge1_staff_id);
                        const subJudge2 = staffs.find((s) => s.id === (m as any).sub_judge2_staff_id);
                        const judgeLabel = [mainJudge?.name, subJudge1?.name, subJudge2?.name].filter(Boolean).join(" / ");
                        return (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm font-medium pl-4">{m.room_name ?? <span className="italic text-xs text-muted-foreground">未割当</span>}</TableCell>
                            <TableCell>
                              {m.section_name
                                ? <Badge variant="outline" className="text-[10px] border-primary/30 text-primary font-medium">{m.section_name}</Badge>
                                : null}
                            </TableCell>
                            <TableCell className="font-semibold text-sm">{m.aff_team_name ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                            <TableCell align="center" className="text-center font-bold text-xs text-muted-foreground/60 w-12">VS</TableCell>
                            <TableCell className="font-semibold text-sm">{m.neg_team_name ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">{judgeLabel || "-"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">{m.timekeeper_name || "-"}</TableCell>
                            <TableCell align="center" className="text-center w-20">
                              {m.is_result_confirmed
                                ? <Badge variant="success" className="text-[10px] font-semibold">確定</Badge>
                                : <Badge variant="outline" className="text-[10px] font-medium">未入力</Badge>}
                            </TableCell>
                            <TableCell align="right" className="pr-4 text-right w-16">
                              <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-primary hover:bg-primary/5 active:scale-95" onClick={() => openEdit(m)}>
                                <Icon name="tune" size={18} />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* Delete confirm */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="全試合を削除"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>キャンセル</Button>
            <Button variant="destructive" onClick={handleDeleteAll} loading={deleting}>すべて削除</Button>
          </>
        }
      >
        <p className="text-sm">
          現在の<strong>{matches.length}</strong>件の試合をすべて削除しますか？<br />
          確定済みの結果も削除されます。この操作は元に戻せません。
        </p>
      </Modal>

      {/* Edit assignment modal */}
      <Modal
        isOpen={!!editForm}
        onClose={() => setEditForm(null)}
        title="試合割当の微調整"
        maxWidth="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditForm(null)} disabled={savingEdit}>キャンセル</Button>
            <Button onClick={handleSaveEdit} loading={savingEdit}>保存</Button>
          </>
        }
      >
        {editForm && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">時間枠</label>
                <select value={editForm.event_timetable_segment_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, event_timetable_segment_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未割当</option>
                  {segments.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">会場</label>
                <select value={editForm.event_room_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, event_room_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未割当</option>
                  {rooms.map((r) => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">肯定側チーム</label>
                <select value={editForm.aff_team_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, aff_team_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {teams.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">否定側チーム</label>
                <select value={editForm.neg_team_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, neg_team_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {teams.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">主審</label>
                <select value={editForm.main_judge_staff_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, main_judge_staff_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {judgeStaffs.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">副審1</label>
                <select value={editForm.sub_judge1_staff_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, sub_judge1_staff_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {judgeStaffs.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">副審2</label>
                <select value={editForm.sub_judge2_staff_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, sub_judge2_staff_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {judgeStaffs.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">司会タイマー</label>
                <select value={editForm.timekeeper_staff_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, timekeeper_staff_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {staffs.filter((s) => s.can_be_timekeeper).map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
