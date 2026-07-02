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
import { generateMatches, deleteAllMatches, updateMatchAssignment, GenerateMatchesRequest } from "@/lib/generateApi";
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

  // Generation
  const [genForm, setGenForm] = useState<GenForm>({
    rounds: 1, judges_per_match: 3,
    assign_judges: true, assign_slots: true, overwrite: false,
  });
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState<{ generated_count: number; warnings: string[] } | null>(null);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "データの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

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
    setError(null);
    try {
      const req: GenerateMatchesRequest = {
        rounds: genForm.rounds,
        judges_per_match: genForm.judges_per_match,
        assign_judges: genForm.assign_judges,
        assign_slots: genForm.assign_slots,
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
      main_judge_staff_id: "",
      sub_judge1_staff_id: "",
      sub_judge2_staff_id: "",
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

      {/* Generation + Status 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Generation form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10"><Icon name="auto_awesome" size={20} className="text-primary" /></div>
              <div>
                <h3 className="font-semibold">試合自動生成</h3>
                <p className="text-xs text-muted-foreground">チーム・スタッフ・時間枠情報から対戦を自動生成します</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">ラウンド数</label>
                <input type="number" min={1} max={10} value={genForm.rounds}
                  onChange={(e) => setGenForm((f) => ({ ...f, rounds: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">1試合のジャッジ数</label>
                <input type="number" min={1} max={5} value={genForm.judges_per_match}
                  onChange={(e) => setGenForm((f) => ({ ...f, judges_per_match: parseInt(e.target.value) || 3 }))}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Options */}
            <div className="space-y-2 border border-border rounded-lg p-3">
              {[
                { key: "assign_slots" as const, label: "時間枠・会場を自動割当", desc: "タイムテーブルと会場情報を使って割り当てます" },
                { key: "assign_judges" as const, label: "ジャッジを自動割当", desc: "利害関係・担当可否を考慮して割り当てます" },
                { key: "overwrite" as const, label: "既存試合を削除して再生成", desc: "現在の試合をすべて削除してから生成します", danger: true },
              ].map(({ key, label, desc, danger }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer group hover:bg-muted/30 p-1.5 rounded-lg">
                  <input type="checkbox" className="mt-0.5 w-4 h-4 accent-primary rounded"
                    checked={genForm[key]} onChange={(e) => setGenForm((f) => ({ ...f, [key]: e.target.checked }))} />
                  <div>
                    <p className={`text-sm font-medium ${danger ? "text-destructive" : ""}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Team/staff info chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { label: `${teams.length}チーム`, icon: "groups", ok: teams.length > 1 },
                { label: `${staffs.length}スタッフ`, icon: "badge", ok: staffs.length > 0 },
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
              <span className="ml-2">{generating ? "生成中..." : "試合を自動生成"}</span>
            </Button>
            {teams.length < 2 && (
              <p className="text-xs text-center text-muted-foreground">
                チームを2チーム以上登録すると生成できます
              </p>
            )}
          </CardContent>
        </Card>

        {/* Status panel */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "総試合数", value: summary.total, icon: "sports", color: "text-primary bg-blue-50" },
              { label: "確定済み", value: summary.confirmed, icon: "check_circle", color: "text-green-700 bg-green-50" },
              { label: "未入力", value: summary.total - summary.confirmed, icon: "pending_actions", color: "text-amber-700 bg-amber-50" },
              { label: "チーム数", value: teams.length, icon: "groups", color: "text-purple-700 bg-purple-50" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm">
                <div className={`p-2 rounded-lg ${color.split(" ")[1]}`}>
                  <Icon name={icon} size={20} className={color.split(" ")[0]} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value}</p>
                </div>
              </div>
            ))}
          </div>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-sm">クイックアクション</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="secondary" className="w-full justify-start" onClick={() => router.push(`/events/${eventId}/matches/board`)}>
                <Icon name="view_list" size={18} />
                <span className="ml-2">進行ボードで確認</span>
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => router.push(`/events/${eventId}/reports/standings`)}>
                <Icon name="leaderboard" size={18} />
                <span className="ml-2">現在の順位表</span>
              </Button>
              <Button variant="secondary" className="w-full justify-start" onClick={() => router.push(`/events/${eventId}/master/teams`)}>
                <Icon name="groups" size={18} />
                <span className="ml-2">チーム管理</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Match list */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">生成済み試合一覧</h3>
            <Badge variant="outline">{matches.length} 試合</Badge>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select value={fSegment} onChange={(e) => setFSegment(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-white text-sm focus:outline-none">
              <option value="all">すべての時間枠</option>
              {uniqueSegments.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
            </select>
            <select value={fSection} onChange={(e) => setFSection(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-border bg-white text-sm focus:outline-none">
              <option value="all">すべての部門</option>
              {uniqueSections.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="border-none rounded-none">
            <TableHeader>
              <TableRow hover={false}>
                <TableHead>時間枠</TableHead>
                <TableHead>会場</TableHead>
                <TableHead>部門</TableHead>
                <TableHead>肯定側</TableHead>
                <TableHead align="center">VS</TableHead>
                <TableHead>否定側</TableHead>
                <TableHead>主審</TableHead>
                <TableHead align="center">状態</TableHead>
                <TableHead align="right">微調整</TableHead>
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
              ) : filteredMatches.length === 0 ? (
                <TableRow hover={false}>
                  <TableCell colSpan={9} className="py-20 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="sports_score" size={44} className="opacity-20" />
                      <p>試合が生成されていません</p>
                      <p className="text-xs">左の「試合を自動生成」ボタンで生成を開始してください</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredMatches.map((m) => {
                  const judgeStaff = staffs.find((s) => s.id === (m as any).main_judge_staff_id);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="text-sm">{m.timetable_segment_name ?? <span className="text-muted-foreground italic text-xs">未割当</span>}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.room_name ?? <span className="italic text-xs">未割当</span>}</TableCell>
                      <TableCell>
                        {m.section_name
                          ? <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">{m.section_name}</Badge>
                          : null}
                      </TableCell>
                      <TableCell className="font-medium">{m.aff_team_name ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                      <TableCell align="center"><span className="text-muted-foreground font-bold text-xs">VS</span></TableCell>
                      <TableCell className="font-medium">{m.neg_team_name ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{judgeStaff?.name ?? "-"}</TableCell>
                      <TableCell align="center">
                        {m.is_result_confirmed
                          ? <Badge variant="success" className="text-[10px]">確定</Badge>
                          : <Badge variant="outline" className="text-[10px]">未入力</Badge>}
                      </TableCell>
                      <TableCell align="right">
                        <Button variant="ghost" size="sm" className="p-1.5 h-auto rounded-full text-primary" onClick={() => openEdit(m)}>
                          <Icon name="tune" size={18} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
