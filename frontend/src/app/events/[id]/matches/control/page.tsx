"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Icon from "@/components/ui/Icon";
import Modal from "@/components/ui/Modal";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/Table";
import { generateMatches, deleteAllMatches, updateMatchAssignment, GenerateMatchesRequest, assignJudges, toggleSegmentLock } from "@/lib/generateApi";
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
  sub_judge3_staff_id: string;
  sub_judge4_staff_id: string;
  timekeeper_staff_id: string;
  event_section_id?: string;
  order_number_in_segment?: number;
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

  // Parallel matches per segment and section
  const [parallelMatches, setParallelMatches] = useState<Record<string, number>>({});
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
  const [judgeResult, setJudgeResult] = useState<{ status: string; updated_count: number; warning?: string } | null>(null);

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit assignment modal
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Filters
  const [fSegment, setFSegment] = useState("all");
  const [fSection, setFSection] = useState("all");
  const [allowReversedPast, setAllowReversedPast] = useState(false);
  const [allowSameGroupDiffTeam, setAllowSameGroupDiffTeam] = useState(false);
  const [allowDiffDay, setAllowDiffDay] = useState(false);
  const [unassignedStaffSegId, setUnassignedStaffSegId] = useState<number | null>(null);

  // Scroll Restorer to prevent page jumping during silent updates
  const mainScrollRef = useRef<number>(0);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!mainEl) return;

    const handleScroll = () => {
      mainScrollRef.current = mainEl.scrollTop;
    };

    mainEl.addEventListener('scroll', handleScroll);
    return () => mainEl.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (mainEl && mainEl.scrollTop !== mainScrollRef.current) {
      mainEl.scrollTop = mainScrollRef.current;
      const rafId = requestAnimationFrame(() => {
        if (mainEl.scrollTop !== mainScrollRef.current) {
          mainEl.scrollTop = mainScrollRef.current;
        }
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [matches]);

  const load = useCallback(async (silent = false) => {
    if (!eventId) return;
    try {
      if (!silent) {
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

        // Initialize parallel matches per segment and section if not set
        setParallelMatches((prev) => {
          const next = { ...prev };
          sectionsData.forEach((sec) => {
            segsData.forEach((seg) => {
              const key = `${sec.id}_${seg.id}`;
              if (next[key] === undefined) {
                const matchCount = matchesData.filter(
                  (m) => m.event_timetable_segment_id === seg.id && m.event_section_id === sec.id
                ).length;
                if (matchCount > 0) {
                  next[key] = matchCount;
                } else {
                  next[key] = 1;
                }
              }
            });
          });
          return next;
        });

        // Initialize judge counts per segment if not set
        setSegmentJudgeCounts((prev) => {
          const next = { ...prev };
          segsData.forEach((s) => {
            if (next[s.id] === undefined) {
              const segMatches = matchesData.filter(m => m.event_timetable_segment_id === s.id);
              if (segMatches.length > 0) {
                let maxAssignedCount = 0;
                segMatches.forEach((m) => {
                  let count = 0;
                  if (m.main_judge_staff_id != null) count = 1;
                  if (m.sub_judge1_staff_id != null) count = 2;
                  if (m.sub_judge2_staff_id != null) count = 3;
                  if (count > maxAssignedCount) {
                    maxAssignedCount = count;
                  }
                });

                if (maxAssignedCount > 0) {
                  next[s.id] = maxAssignedCount;
                } else {
                  const firstWithCount = segMatches.find(m => m.judges_assignment_count != null && m.judges_assignment_count > 0);
                  if (firstWithCount && firstWithCount.judges_assignment_count != null) {
                    next[s.id] = firstWithCount.judges_assignment_count;
                  } else {
                    next[s.id] = 3;
                  }
                }
              } else {
                next[s.id] = 3;
              }
            }
          });
          return next;
        });
      } else {
        // Silent load: ONLY load matches and summary to prevent scroll resetting
        const mainEl = document.querySelector('main');
        const scrollTop = mainEl ? mainEl.scrollTop : null;

        const [matchesData, summaryData] = await Promise.all([
          fetchMatches(eventId),
          fetchMatchSummary(eventId),
        ]);
        setMatches(matchesData);
        setSummary(summaryData);

        if (mainEl && scrollTop !== null) {
          setTimeout(() => {
            mainEl.scrollTop = scrollTop;
          }, 0);
        }
      }
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : "データの取得に失敗しました");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [eventId]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  // データベースからの実際の試合に、パラメータ設定による「仮の空枠」をマージした表示用のリストを作成
  const displayMatches = useMemo(() => {
    let virtualIdCounter = -1;
    const sortedRooms = [...rooms].sort((a, b) => (a.order_number ?? 0) - (b.order_number ?? a.id));
    const result: MatchListItem[] = [];

    segments.forEach((seg) => {
      // このセグメントに属する実際の試合
      const actualSegMatches = matches.filter((m) => m.event_timetable_segment_id === seg.id);

      // 部門ごとに処理
      sections.forEach((sec) => {
        // このセグメント・部門の実際の試合
        const actualSecMatches = actualSegMatches.filter((m) => m.event_section_id === sec.id);

        // パラメータでの設定値
        const key = `${sec.id}_${seg.id}`;
        const targetCount = parallelMatches[key] ?? 0;

        // 実際の試合を結果に追加
        result.push(...actualSecMatches);

        // 不足分があれば仮想（空）の試合を追加
        const missingCount = targetCount - actualSecMatches.length;
        if (missingCount > 0) {
          // すでに使われている部屋IDのセット
          const usedRoomIds = new Set(actualSegMatches.map(m => m.event_room_id).filter(id => id != null));
          // 空いている部屋を探す
          const availableRooms = sortedRooms.filter(r => !usedRoomIds.has(r.id));

          for (let i = 0; i < missingCount; i++) {
            const room = availableRooms[i] || null;
            result.push({
              id: virtualIdCounter--,
              event_id: eventId ?? 0,
              event_timetable_segment_id: seg.id,
              event_room_id: room ? room.id : null,
              event_section_id: sec.id,
              aff_team_id: null,
              neg_team_id: null,
              main_judge_staff_id: null,
              sub_judge1_staff_id: null,
              sub_judge2_staff_id: null,
              sub_judge3_staff_id: null,
              sub_judge4_staff_id: null,
              timekeeper_staff_id: null,
              judges_assignment_count: segmentJudgeCounts[seg.id] ?? 3,
              order_number_in_segment: actualSegMatches.length + i + 1,
              is_staffs_fixed: false,
              is_result_confirmed: false,
              timetable_segment_name: seg.name,
              room_name: room ? room.name : undefined,
              section_name: sec.name,
              // カスタムプロパティ（バーチャル判定用）
              is_virtual: true,
            } as any);
          }
        }
      });
    });

    return result;
  }, [matches, parallelMatches, rooms, sections, segments, eventId, segmentJudgeCounts]);

  // Filter display matches
  const filteredDisplayMatches = useMemo(() => {
    return displayMatches.filter((m) => {
      const matchSeg = fSegment === "all" || String(m.event_timetable_segment_id) === fSegment;
      const matchSec = fSection === "all" || String(m.event_section_id) === fSection;
      return matchSeg && matchSec;
    });
  }, [displayMatches, fSegment, fSection]);

  async function handleGenerate(asSkeleton: boolean = false) {
    if (!eventId) return;
    if (matches.length > 0) {
      const msg = asSkeleton
        ? "確定されていない試合を削除し、出場校やスタッフが空の「空の枠組み」を生成します。よろしいですか？"
        : "確定されていない試合を削除して再生成します。よろしいですか？";
      if (!confirm(msg)) return;
    }
    setGenerating(true);
    setGenResult(null);
    setJudgeResult(null);
    setError(null);
    try {
      const req: GenerateMatchesRequest = {
        section_segment_parallel_matches: parallelMatches,
        overwrite: false,
        as_skeleton: asSkeleton,
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
      const result = await assignJudges(eventId, segmentJudgeCounts, allowReversedPast, allowSameGroupDiffTeam, allowDiffDay);
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
      sub_judge3_staff_id: m.sub_judge3_staff_id != null ? String(m.sub_judge3_staff_id) : "",
      sub_judge4_staff_id: m.sub_judge4_staff_id != null ? String(m.sub_judge4_staff_id) : "",
      timekeeper_staff_id: m.timekeeper_staff_id != null ? String(m.timekeeper_staff_id) : "",
      event_section_id: m.event_section_id != null ? String(m.event_section_id) : "",
      order_number_in_segment: m.order_number_in_segment ?? 1,
    });
  }

  async function handleSaveEdit() {
    if (!eventId || !editForm) return;
    const match = matches.find(m => m.id === editForm.matchId);
    if (match?.is_staffs_fixed) {
      alert("この試合は確定されているため編集できません。");
      return;
    }
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
      if (editForm.sub_judge3_staff_id) update.sub_judge3_staff_id = parseInt(editForm.sub_judge3_staff_id);
      if (editForm.sub_judge4_staff_id) update.sub_judge4_staff_id = parseInt(editForm.sub_judge4_staff_id);
      if (editForm.timekeeper_staff_id) update.timekeeper_staff_id = parseInt(editForm.timekeeper_staff_id);
      if (editForm.event_section_id) update.event_section_id = parseInt(editForm.event_section_id);
      if (editForm.order_number_in_segment) update.order_number_in_segment = editForm.order_number_in_segment;

      await updateMatchAssignment(eventId, editForm.matchId, update);
      setEditForm(null);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSavingEdit(false);
    }
  }

  const [activeDropdown, setActiveDropdown] = useState<{ matchId: number; role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper' } | null>(null);
  const [isParamsOpen, setIsParamsOpen] = useState(false);

  const [dragOverTarget, setDragOverTarget] = useState<{ matchId: number; role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper' } | null>(null);

  function handleDragStart(e: React.DragEvent, matchId: number, role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper') {
    e.dataTransfer.setData("text/plain", JSON.stringify({ matchId, role }));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, isLocked: boolean) {
    if (isLocked) return;
    e.preventDefault();
  }

  function handleDragEnter(e: React.DragEvent, matchId: number, role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper', isLocked: boolean) {
    if (isLocked) return;
    e.preventDefault();
    setDragOverTarget({ matchId, role });
  }

  function handleDragLeave() {
    setDragOverTarget(null);
  }

  async function handleDrop(e: React.DragEvent, targetMatchId: number, targetRole: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper', targetLocked: boolean) {
    e.preventDefault();
    setDragOverTarget(null);
    if (targetLocked) return;

    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { matchId: sourceMatchId, role: sourceRole } = JSON.parse(dataStr) as {
        matchId: number;
        role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper';
      };

      if (sourceMatchId === targetMatchId && sourceRole === targetRole) return;

      const sourceMatch = matches.find((m) => m.id === sourceMatchId);
      const targetMatch = matches.find((m) => m.id === targetMatchId);
      if (!sourceMatch || !targetMatch) return;
      if (sourceMatch.is_staffs_fixed || targetMatch.is_staffs_fixed) {
        alert("確定されている時間枠の審判は移動・入れ替えできません。");
        return;
      }

      const sourceStaffId = sourceRole === 'main' ? sourceMatch.main_judge_staff_id :
                           sourceRole === 'sub1' ? sourceMatch.sub_judge1_staff_id :
                           sourceRole === 'sub2' ? sourceMatch.sub_judge2_staff_id :
                           sourceRole === 'sub3' ? sourceMatch.sub_judge3_staff_id :
                           sourceRole === 'sub4' ? sourceMatch.sub_judge4_staff_id :
                           sourceMatch.timekeeper_staff_id;

      const targetStaffId = targetRole === 'main' ? targetMatch.main_judge_staff_id :
                           targetRole === 'sub1' ? targetMatch.sub_judge1_staff_id :
                           targetRole === 'sub2' ? targetMatch.sub_judge2_staff_id :
                           targetRole === 'sub3' ? targetMatch.sub_judge3_staff_id :
                           targetRole === 'sub4' ? targetMatch.sub_judge4_staff_id :
                           targetMatch.timekeeper_staff_id;

      // Optimistic local update
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id === sourceMatchId && m.id === targetMatchId) {
            const updated = { ...m };
            const sourceKey = sourceRole === 'main' ? 'main_judge_staff_id' :
                              sourceRole === 'sub1' ? 'sub_judge1_staff_id' :
                              sourceRole === 'sub2' ? 'sub_judge2_staff_id' :
                              sourceRole === 'sub3' ? 'sub_judge3_staff_id' :
                              sourceRole === 'sub4' ? 'sub_judge4_staff_id' :
                              'timekeeper_staff_id';
            const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                              targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                              targetRole === 'sub2' ? 'sub_judge2_staff_id' :
                              targetRole === 'sub3' ? 'sub_judge3_staff_id' :
                              targetRole === 'sub4' ? 'sub_judge4_staff_id' :
                              'timekeeper_staff_id';
            updated[sourceKey] = targetStaffId;
            updated[targetKey] = sourceStaffId;
            return updated;
          } else if (m.id === sourceMatchId) {
            const updated = { ...m };
            const sourceKey = sourceRole === 'main' ? 'main_judge_staff_id' :
                              sourceRole === 'sub1' ? 'sub_judge1_staff_id' :
                              sourceRole === 'sub2' ? 'sub_judge2_staff_id' :
                              sourceRole === 'sub3' ? 'sub_judge3_staff_id' :
                              sourceRole === 'sub4' ? 'sub_judge4_staff_id' :
                              'timekeeper_staff_id';
            updated[sourceKey] = targetStaffId;
            return updated;
          } else if (m.id === targetMatchId) {
            const updated = { ...m };
            const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                              targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                              targetRole === 'sub2' ? 'sub_judge2_staff_id' :
                              targetRole === 'sub3' ? 'sub_judge3_staff_id' :
                              targetRole === 'sub4' ? 'sub_judge4_staff_id' :
                              'timekeeper_staff_id';
            updated[targetKey] = sourceStaffId;
            return updated;
          }
          return m;
        })
      );

      if (sourceMatchId === targetMatchId) {
        const update: Record<string, number | null> = {};
        const sourceKey = sourceRole === 'main' ? 'main_judge_staff_id' :
                          sourceRole === 'sub1' ? 'sub_judge1_staff_id' :
                          sourceRole === 'sub2' ? 'sub_judge2_staff_id' :
                          sourceRole === 'sub3' ? 'sub_judge3_staff_id' :
                          sourceRole === 'sub4' ? 'sub_judge4_staff_id' :
                          'timekeeper_staff_id';
        const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                          targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                          targetRole === 'sub2' ? 'sub_judge2_staff_id' :
                          targetRole === 'sub3' ? 'sub_judge3_staff_id' :
                          targetRole === 'sub4' ? 'sub_judge4_staff_id' :
                          'timekeeper_staff_id';

        update[sourceKey] = targetStaffId;
        update[targetKey] = sourceStaffId;

        await updateMatchAssignment(eventId!, sourceMatchId, update);
      } else {
        const updateSource: Record<string, number | null> = {};
        const updateTarget: Record<string, number | null> = {};

        const sourceKey = sourceRole === 'main' ? 'main_judge_staff_id' :
                          sourceRole === 'sub1' ? 'sub_judge1_staff_id' :
                          sourceRole === 'sub2' ? 'sub_judge2_staff_id' :
                          sourceRole === 'sub3' ? 'sub_judge3_staff_id' :
                          sourceRole === 'sub4' ? 'sub_judge4_staff_id' :
                          'timekeeper_staff_id';
        const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                          targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                          targetRole === 'sub2' ? 'sub_judge2_staff_id' :
                          targetRole === 'sub3' ? 'sub_judge3_staff_id' :
                          targetRole === 'sub4' ? 'sub_judge4_staff_id' :
                          'timekeeper_staff_id';

        updateSource[sourceKey] = targetStaffId;
        updateTarget[targetKey] = sourceStaffId;

        await Promise.all([
          updateMatchAssignment(eventId!, sourceMatchId, updateSource),
          updateMatchAssignment(eventId!, targetMatchId, updateTarget)
        ]);
      }

      await load(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "入れ替えに失敗しました");
      await load();
    }
  }

  async function handleToggleSegmentLock(segmentId: number, isFixed: boolean) {
    if (!eventId) return;
    setMatches((prev) =>
      prev.map((m) => {
        if (m.event_timetable_segment_id === segmentId) {
          return { ...m, is_staffs_fixed: isFixed };
        }
        return m;
      })
    );
    try {
      await toggleSegmentLock(eventId, segmentId, isFixed);
      await load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "確定状態の更新に失敗しました");
      await load();
    }
  }

  async function handleUpdateRole(matchId: number, role: string, staffId: number | null) {
    if (!eventId) return;
    setMatches((prev) =>
      prev.map((m) => {
        if (m.id === matchId) {
          const updated = { ...m };
          if (role === 'main') updated.main_judge_staff_id = staffId;
          if (role === 'sub1') updated.sub_judge1_staff_id = staffId;
          if (role === 'sub2') updated.sub_judge2_staff_id = staffId;
          if (role === 'sub3') updated.sub_judge3_staff_id = staffId;
          if (role === 'sub4') updated.sub_judge4_staff_id = staffId;
          if (role === 'timekeeper') updated.timekeeper_staff_id = staffId;
          return updated;
        }
        return m;
      })
    );
    try {
      const update: Record<string, number | null> = {};
      if (role === 'main') update.main_judge_staff_id = staffId;
      if (role === 'sub1') update.sub_judge1_staff_id = staffId;
      if (role === 'sub2') update.sub_judge2_staff_id = staffId;
      if (role === 'sub3') update.sub_judge3_staff_id = staffId;
      if (role === 'sub4') update.sub_judge4_staff_id = staffId;
      if (role === 'timekeeper') update.timekeeper_staff_id = staffId;

      await updateMatchAssignment(eventId, matchId, update);
      await load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新に失敗しました");
      await load();
    }
  }

  const checkPastSchoolConflict = useCallback((staffId: number, match: MatchListItem) => {
    const affTeam = teams.find((t) => t.id === match.aff_team_id);
    const negTeam = teams.find((t) => t.id === match.neg_team_id);
    const affSchoolId = affTeam?.event_school_id;
    const negSchoolId = negTeam?.event_school_id;

    const sortedSegments = [...segments].sort((a, b) => {
      if (a.order_number !== b.order_number) {
        return (a.order_number ?? 0) - (b.order_number ?? 0);
      }
      return a.id - b.id;
    });

    const currentSegIdx = sortedSegments.findIndex((s) => s.id === match.event_timetable_segment_id);
    if (currentSegIdx <= 0) return false;

    // 日付グループ(dayIndex)の計算
    const dayMap = new Map<number, number>();
    let dayIndex = 0;
    let prevTime: string | null = null;
    for (const seg of sortedSegments) {
      if (seg.start_time && prevTime && seg.start_time < prevTime) {
        dayIndex++;
      }
      dayMap.set(seg.id, dayIndex);
      if (seg.start_time) {
        prevTime = seg.start_time;
      }
    }

    const currentDay = match.event_timetable_segment_id != null ? (dayMap.get(match.event_timetable_segment_id) ?? 0) : 0;

    // pastSegments のフィルタリング
    const pastSegments = sortedSegments.slice(0, currentSegIdx).filter((s) => {
      if (allowDiffDay) {
        // 日別区別フラグが有効な場合、同じ日付の過去セグメントのみを対象とする
        return dayMap.get(s.id) === currentDay;
      }
      return true;
    });

    const pastSegmentIds = new Set(pastSegments.map((s) => s.id));
    const pastMatches = matches.filter((pastM) => pastM.event_timetable_segment_id !== null && pastSegmentIds.has(pastM.event_timetable_segment_id));

    if (allowSameGroupDiffTeam) {
      // チーム単位で重複チェック
      const seenTeamsAsAff = new Set<number>();
      const seenTeamsAsNeg = new Set<number>();

      pastMatches.forEach((pastM) => {
        const isAssigned = (
          pastM.main_judge_staff_id === staffId ||
          pastM.sub_judge1_staff_id === staffId ||
          pastM.sub_judge2_staff_id === staffId ||
          pastM.sub_judge3_staff_id === staffId ||
          pastM.sub_judge4_staff_id === staffId ||
          pastM.timekeeper_staff_id === staffId
        );
        if (isAssigned && pastM.event_section_id === match.event_section_id) {
          if (pastM.aff_team_id) seenTeamsAsAff.add(pastM.aff_team_id);
          if (pastM.neg_team_id) seenTeamsAsNeg.add(pastM.neg_team_id);
        }
      });

      if (allowReversedPast) {
        const hasAffConflict = match.aff_team_id && seenTeamsAsAff.has(match.aff_team_id);
        const hasNegConflict = match.neg_team_id && seenTeamsAsNeg.has(match.neg_team_id);
        return !!(hasAffConflict || hasNegConflict);
      } else {
        const allSeenTeams = new Set([...seenTeamsAsAff, ...seenTeamsAsNeg]);
        return !!(
          (match.aff_team_id && allSeenTeams.has(match.aff_team_id)) ||
          (match.neg_team_id && allSeenTeams.has(match.neg_team_id))
        );
      }
    } else {
      // 学校単位で重複チェック
      const seenSchoolsAsAff = new Set<number>();
      const seenSchoolsAsNeg = new Set<number>();

      pastMatches.forEach((pastM) => {
        const isAssigned = (
          pastM.main_judge_staff_id === staffId ||
          pastM.sub_judge1_staff_id === staffId ||
          pastM.sub_judge2_staff_id === staffId ||
          pastM.sub_judge3_staff_id === staffId ||
          pastM.sub_judge4_staff_id === staffId ||
          pastM.timekeeper_staff_id === staffId
        );
        if (isAssigned && pastM.event_section_id === match.event_section_id) {
          const pastAffTeam = teams.find((t) => t.id === pastM.aff_team_id);
          const pastNegTeam = teams.find((t) => t.id === pastM.neg_team_id);
          if (pastAffTeam?.event_school_id) seenSchoolsAsAff.add(pastAffTeam.event_school_id);
          if (pastNegTeam?.event_school_id) seenSchoolsAsNeg.add(pastNegTeam.event_school_id);
        }
      });

      if (allowReversedPast) {
        const hasAffConflict = affSchoolId && seenSchoolsAsAff.has(affSchoolId);
        const hasNegConflict = negSchoolId && seenSchoolsAsNeg.has(negSchoolId);
        return !!(hasAffConflict || hasNegConflict);
      } else {
        const allSeenSchools = new Set([...seenSchoolsAsAff, ...seenSchoolsAsNeg]);
        return !!(
          (affSchoolId && allSeenSchools.has(affSchoolId)) ||
          (negSchoolId && allSeenSchools.has(negSchoolId))
        );
      }
    }
  }, [teams, segments, matches, allowReversedPast, allowSameGroupDiffTeam, allowDiffDay]);

  const getSortedCandidates = (match: MatchListItem, role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper', segmentStaffAssignments: Record<number, number>, seg: any) => {
    const candidates = staffs.filter((s) => {
      if (role === 'timekeeper') return s.can_be_timekeeper;
      if (role === 'main') return s.can_be_main_judge;
      return s.can_be_sub_judge;
    });

    const affTeam = teams.find((t) => t.id === match.aff_team_id);
    const negTeam = teams.find((t) => t.id === match.neg_team_id);
    const affSchoolId = affTeam?.event_school_id;
    const negSchoolId = negTeam?.event_school_id;

    const mapped = candidates.map((staff) => {
      const isDuplicate = matches.some((m) => {
        if (m.event_timetable_segment_id === match.event_timetable_segment_id) {
          if (m.id !== match.id) {
            return m.main_judge_staff_id === staff.id ||
                   m.sub_judge1_staff_id === staff.id ||
                   m.sub_judge2_staff_id === staff.id ||
                   m.sub_judge3_staff_id === staff.id ||
                   m.sub_judge4_staff_id === staff.id ||
                   m.timekeeper_staff_id === staff.id;
          } else {
            return (role !== 'main' && m.main_judge_staff_id === staff.id) ||
                   (role !== 'sub1' && m.sub_judge1_staff_id === staff.id) ||
                   (role !== 'sub2' && m.sub_judge2_staff_id === staff.id) ||
                   (role !== 'sub3' && m.sub_judge3_staff_id === staff.id) ||
                   (role !== 'sub4' && m.sub_judge4_staff_id === staff.id) ||
                   (role !== 'timekeeper' && m.timekeeper_staff_id === staff.id);
          }
        }
        return false;
      });

      const isSchoolConflict = !!(
        (affSchoolId && staff.interested_school_ids?.includes(affSchoolId)) ||
        (negSchoolId && staff.interested_school_ids?.includes(negSchoolId))
      );

      const hasSeenSameSchoolInPast = checkPastSchoolConflict(staff.id, match);

      const isTimeUnavailable = !!(
        staff.present_segment_ids &&
        staff.present_segment_ids.length > 0 &&
        match.event_timetable_segment_id != null &&
        !staff.present_segment_ids.includes(match.event_timetable_segment_id)
      );

      return {
        staff,
        isDuplicate,
        isPast: hasSeenSameSchoolInPast,
        isRelation: isSchoolConflict,
        isTimeUnavailable
      };
    });

    const getSortScore = (cand: { isDuplicate: boolean; isPast: boolean; isRelation: boolean; isTimeUnavailable: boolean }) => {
      const { isDuplicate: d, isPast: p, isRelation: r, isTimeUnavailable: tu } = cand;
      if (tu) return 10;
      if (!d && !p && !r) return 1;
      if (d && !p && !r) return 2;
      if (p && !d && !r) return 3;
      if (d && p && !r) return 4;
      if (d && r && !p) return 5;
      if (d && p && r) return 6;
      if (r && !d) return 7;
      return 8;
    };

    return mapped.sort((a, b) => {
      const scoreA = getSortScore(a);
      const scoreB = getSortScore(b);
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      return a.staff.id - b.staff.id;
    });
  };

  const renderSlot = (match: MatchListItem, role: 'main' | 'sub1' | 'sub2' | 'sub3' | 'sub4' | 'timekeeper', label: string, segmentStaffAssignments: Record<number, number>, seg: any) => {
    const staffId = role === 'main' ? match.main_judge_staff_id :
                    role === 'sub1' ? match.sub_judge1_staff_id :
                    role === 'sub2' ? match.sub_judge2_staff_id :
                    role === 'sub3' ? match.sub_judge3_staff_id :
                    role === 'sub4' ? match.sub_judge4_staff_id :
                    match.timekeeper_staff_id;

    const staff = staffs.find((s) => s.id === staffId);
    const isLocked = match.is_staffs_fixed || match.id < 0;

    let chipClass = "border-dashed border-border/80 bg-transparent text-muted-foreground/60 font-normal";
    let isDuplicate = false;
    let isSchoolConflict = false;
    let hasSeenSameSchoolInPast = false;

    if (staff) {
      isDuplicate = (segmentStaffAssignments[staff.id] || 0) > 1;

      const affTeam = teams.find((t) => t.id === match.aff_team_id);
      const negTeam = teams.find((t) => t.id === match.neg_team_id);
      const affSchoolId = affTeam?.event_school_id;
      const negSchoolId = negTeam?.event_school_id;

      isSchoolConflict = !!(
        (affSchoolId && staff.interested_school_ids?.includes(affSchoolId)) ||
        (negSchoolId && staff.interested_school_ids?.includes(negSchoolId))
      );

      hasSeenSameSchoolInPast = checkPastSchoolConflict(staff.id, match);

      const isTimeUnavailable = !!(
        staff.present_segment_ids &&
        staff.present_segment_ids.length > 0 &&
        match.event_timetable_segment_id != null &&
        !staff.present_segment_ids.includes(match.event_timetable_segment_id)
      );

      chipClass = "bg-secondary/20 border-border/80 text-foreground font-medium";
      if (isTimeUnavailable) {
        chipClass = "bg-gray-100 border-gray-300 text-gray-400 dark:bg-gray-800/40 dark:border-gray-700 dark:text-gray-500 font-normal";
      } else if (isDuplicate) {
        chipClass = "bg-red-50 border-red-200 text-red-600 font-semibold";
      } else if (isSchoolConflict) {
        chipClass = "bg-amber-50 border-amber-200 text-amber-600 font-semibold";
      } else if (hasSeenSameSchoolInPast) {
        chipClass = "bg-blue-50 border-blue-200 text-blue-600 font-semibold";
      }
    }

    const isOpen = activeDropdown?.matchId === match.id && activeDropdown?.role === role;

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isLocked) return;
      if (isOpen) {
        setActiveDropdown(null);
      } else {
        setActiveDropdown({ matchId: match.id, role });
      }
    };

    const isDragOver = dragOverTarget?.matchId === match.id && dragOverTarget?.role === role;

    return (
      <div
        className="relative inline-block text-left"
        onDragOver={(e) => handleDragOver(e, isLocked)}
        onDragEnter={(e) => handleDragEnter(e, match.id, role, isLocked)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, match.id, role, isLocked)}
      >
        <span
          onClick={handleClick}
          draggable={!isLocked && !!staff}
          onDragStart={(e) => handleDragStart(e, match.id, role)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs shadow-xs transition-all w-[130px] min-w-[130px] shrink-0 select-none
            ${isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:shadow-sm active:scale-98'}
            ${isDragOver ? 'ring-2 ring-primary border-primary bg-primary/10 scale-102 shadow-md' : ''}
            ${chipClass}`}
        >
          <span className="text-[10px] font-bold text-muted-foreground/60 mr-0.5 bg-black/5 dark:bg-white/10 px-1 py-0.5 rounded shrink-0 pointer-events-none">
            {label}
          </span>
          <span className="inline-block flex-1 min-w-0 truncate align-bottom text-left pointer-events-none" title={staff?.name || "未設定"}>
            {staff?.name || "未設定"}
          </span>
        </span>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setActiveDropdown(null); }} />
            <div className="absolute left-0 mt-1 w-[200px] max-h-60 overflow-y-auto bg-white border border-border rounded-lg shadow-lg z-50 py-1 text-sm text-left">
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  setActiveDropdown(null);
                  await handleUpdateRole(match.id, role, null);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary/40 border-b border-border/50 flex items-center gap-1"
              >
                <Icon name="clear" size={14} />
                <span>未設定にリセット</span>
              </button>

              {getSortedCandidates(match, role, segmentStaffAssignments, seg).map((cand) => {
                const candColorClass = cand.isTimeUnavailable ? "bg-gray-50 text-gray-400 hover:bg-gray-100/80 dark:bg-gray-900/20" :
                                       cand.isDuplicate ? "bg-red-50 text-red-700 hover:bg-red-100" :
                                       cand.isRelation ? "bg-amber-50 text-amber-700 hover:bg-amber-100" :
                                       cand.isPast ? "bg-blue-50 text-blue-700 hover:bg-blue-100" :
                                       "hover:bg-secondary/40 text-foreground";
                return (
                  <button
                    key={cand.staff.id}
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      setActiveDropdown(null);
                      await handleUpdateRole(match.id, role, cand.staff.id);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between ${candColorClass}`}
                  >
                    <span className="font-semibold truncate mr-2">{cand.staff.name}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {cand.isTimeUnavailable && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-white/60 border border-gray-300 text-gray-400 shrink-0">
                          時間外
                        </span>
                      )}
                      {cand.isDuplicate && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-white/60 border border-red-300 text-red-700 shrink-0">
                          重複
                        </span>
                      )}
                      {cand.isRelation && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-white/60 border border-amber-300 text-amber-700 shrink-0">
                          関係
                        </span>
                      )}
                      {cand.isPast && (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-white/60 border border-blue-300 text-blue-700 shrink-0">
                          過去
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderJudges = (m: MatchListItem, segmentStaffAssignments: Record<number, number>, seg: any) => {
    const segId = m.event_timetable_segment_id;
    const expectedJudgeCount = (segId !== null ? segmentJudgeCounts[segId] : null) ?? (m.judges_assignment_count || 3);

    if (expectedJudgeCount <= 3) {
      return (
        <div className="flex gap-1.5 items-start">
          {/* Left side: Main judge */}
          <div>
            {renderSlot(m, 'main', '主', segmentStaffAssignments, seg)}
          </div>
          {/* Right side: Sub judges stacked vertically */}
          <div className="flex flex-col gap-1.5">
            {expectedJudgeCount >= 2 && renderSlot(m, 'sub1', '副', segmentStaffAssignments, seg)}
            {expectedJudgeCount >= 3 && renderSlot(m, 'sub2', '副', segmentStaffAssignments, seg)}
          </div>
        </div>
      );
    } else if (expectedJudgeCount === 4) {
      return (
        <div className="grid grid-cols-2 gap-1.5">
          {renderSlot(m, 'main', '主', segmentStaffAssignments, seg)}
          {renderSlot(m, 'sub1', '副', segmentStaffAssignments, seg)}
          {renderSlot(m, 'sub2', '副', segmentStaffAssignments, seg)}
          {renderSlot(m, 'sub3', '副', segmentStaffAssignments, seg)}
        </div>
      );
    } else {
      return (
        <div className="flex flex-col gap-1.5 items-start">
          {/* Top: Main judge */}
          <div>
            {renderSlot(m, 'main', '主', segmentStaffAssignments, seg)}
          </div>
          {/* Bottom: 2x2 grid for sub judges */}
          <div className="grid grid-cols-2 gap-1.5">
            {renderSlot(m, 'sub1', '副', segmentStaffAssignments, seg)}
            {renderSlot(m, 'sub2', '副', segmentStaffAssignments, seg)}
            {renderSlot(m, 'sub3', '副', segmentStaffAssignments, seg)}
            {expectedJudgeCount >= 5 && renderSlot(m, 'sub4', '副', segmentStaffAssignments, seg)}
          </div>
        </div>
      );
    }
  };

  const judgeStaffs = staffs.filter((s) => s.can_be_main_judge || s.can_be_sub_judge);
  const filteredTeamsForModal = useMemo(() => {
    if (!editForm?.event_section_id) return teams;
    const sectionId = parseInt(editForm.event_section_id);
    return teams.filter((t) => t.event_section_id === sectionId);
  }, [teams, editForm?.event_section_id]);
  const uniqueSegments = Array.from(new Map(matches.filter((m) => m.timetable_segment_name).map((m) => [m.event_timetable_segment_id, m.timetable_segment_name])).entries());
  const uniqueSections = Array.from(new Map(matches.filter((m) => m.section_name).map((m) => [m.event_section_id, m.section_name])).entries());

  if (!eventId || isNaN(eventId)) {
    return <div className="text-center py-16 text-muted-foreground"><p>大会IDが無効です</p></div>;
  }

  return (
    <div className="space-y-6 pb-64">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">組み合わせ制御</h1>
          <p className="text-sm text-muted-foreground mt-1">
            試合の対戦カード・ジャッジ・会場を自動生成または手動調整します。
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outlined" size="sm" icon="refresh" onClick={() => load()}>更新</Button>
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
        <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <Icon name="check_circle" size={18} />
            {judgeResult.updated_count}件の試合に審判を自動割り当てしました
          </p>
          {judgeResult.warning && (
            <p className="text-amber-700 font-medium flex items-start gap-1.5 mt-1 bg-amber-50/50 p-2 rounded border border-amber-200/50">
              <Icon name="warning" size={16} className="mt-0.5 shrink-0" />
              <span>{judgeResult.warning}</span>
            </p>
          )}
        </div>
      )}

      {/* Integrated Parameter Table Card */}
      <Card className="overflow-hidden">
        <CardHeader
          onClick={() => setIsParamsOpen(!isParamsOpen)}
          className="cursor-pointer hover:bg-muted/10 transition-colors flex flex-row items-center justify-between py-4"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10"><Icon name="settings" size={20} className="text-primary" /></div>
            <div>
              <h3 className="font-semibold text-base text-foreground">時間枠別パラメータ設定</h3>
              <p className="text-xs text-muted-foreground">各時間枠における並行試合数と1試合あたりの審判数を設定します</p>
            </div>
          </div>
          <Icon name={isParamsOpen ? "expand_less" : "expand_more"} size={24} className="text-muted-foreground transition-transform" />
        </CardHeader>
        {isParamsOpen && (
          <CardContent className="p-0 border-t border-border/60">
            <Table className="border-none rounded-none">
              <TableHeader>
                <TableRow hover={false}>
                  <TableHead>時間枠</TableHead>
                  <TableHead align="center" className="w-1/3 text-center">部門別の各枠並行試合数設定</TableHead>
                  <TableHead align="center" className="w-1/3 text-center">各枠の1試合あたりジャッジ数設定</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((seg) => (
                  <TableRow key={seg.id}>
                    <TableCell className="font-semibold text-foreground py-3">
                      <p className="text-sm">{seg.name}</p>
                      {seg.start_time && <p className="text-xs text-muted-foreground font-normal">{seg.start_time}開始</p>}
                    </TableCell>
                    
                    {/* Parallel Matches Column (Per Section) */}
                    <TableCell align="center" className="py-3">
                      <div className="flex flex-col gap-2 items-center justify-center">
                        {sections.map((sec) => {
                          const key = `${sec.id}_${seg.id}`;
                          const val = parallelMatches[key] ?? 0;
                          return (
                            <div key={sec.id} className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-muted-foreground w-24 text-right truncate">{sec.name}:</span>
                              <div className="inline-flex items-center gap-1 bg-white border border-border rounded-lg p-0.5 shadow-sm">
                                <button
                                  type="button"
                                  onClick={() => setParallelMatches((prev) => ({ ...prev, [key]: Math.max(0, val - 1) }))}
                                  className="w-6 h-6 rounded bg-secondary hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-[10px]"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min={0}
                                  max={rooms.length || 10}
                                  value={val}
                                  onChange={(e) => {
                                    const v = Math.max(0, parseInt(e.target.value) || 0);
                                    setParallelMatches((prev) => ({ ...prev, [key]: v }));
                                  }}
                                  className="w-8 text-center text-xs font-semibold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => setParallelMatches((prev) => ({ ...prev, [key]: Math.min(rooms.length || 10, val + 1) }))}
                                  className="w-6 h-6 rounded bg-secondary hover:bg-muted active:scale-90 flex items-center justify-center font-bold text-[10px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                    
                    {/* Judge Count Column */}
                    <TableCell align="center" className="py-3">
                      <div className="inline-flex items-center gap-1 bg-white border border-border rounded-lg p-0.5 shadow-sm">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {/* Card Footer with options */}
            <div className="border-t border-border p-4 bg-secondary/5">
              <div className="flex flex-col gap-2 p-2.5 rounded-lg bg-white border border-border/85 shadow-xs">
                <div className="flex items-center gap-2">
                  <input
                    id="allow-reversed-past-checkbox"
                    type="checkbox"
                    checked={allowReversedPast}
                    onChange={(e) => setAllowReversedPast(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <label
                    htmlFor="allow-reversed-past-checkbox"
                    className="text-xs font-semibold text-foreground cursor-pointer select-none"
                  >
                    肯否逆であれば過去に見た学校であっても割り当てを許可する
                  </label>
                </div>
                <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                  <input
                    id="allow-same-group-diff-team-checkbox"
                    type="checkbox"
                    checked={allowSameGroupDiffTeam}
                    onChange={(e) => setAllowSameGroupDiffTeam(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <label
                    htmlFor="allow-same-group-diff-team-checkbox"
                    className="text-xs font-semibold text-foreground cursor-pointer select-none"
                  >
                    同じグループ（学校）に属していても別チームであれば割り当てを許可する
                  </label>
                </div>
                <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                  <input
                    id="allow-diff-day-checkbox"
                    type="checkbox"
                    checked={allowDiffDay}
                    onChange={(e) => setAllowDiffDay(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer"
                  />
                  <label
                    htmlFor="allow-diff-day-checkbox"
                    className="text-xs font-semibold text-foreground cursor-pointer select-none"
                  >
                    違う日の試合であれば過去担当済みであっても割り当てを許可する
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Action Buttons Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Button
            className="w-full font-semibold"
            onClick={() => handleGenerate(false)}
            loading={generating}
            disabled={teams.length < 2}
          >
            <Icon name="auto_awesome" size={18} />
            <span className="ml-2">{generating ? "生成中..." : "試合の組み合わせを生成"}</span>
          </Button>
          {teams.length < 2 && (
            <p className="text-xs text-center text-muted-foreground mt-1">
              チームを2チーム以上登録すると生成できます
            </p>
          )}
        </div>

        <div>
          <Button
            className="w-full font-semibold"
            variant="outlined"
            onClick={() => handleGenerate(true)}
            loading={generating}
          >
            <Icon name="restart_alt" size={18} />
            <span className="ml-2">{generating ? "リセット中..." : "組み合わせをリセット"}</span>
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-1">
            出場校・スタッフが空の枠組みのみを生成
          </p>
        </div>
        
        <div>
          <Button
            className="w-full font-semibold"
            variant="outlined"
            onClick={handleAssignJudges}
            loading={assigningJudges}
            disabled={matches.length === 0 || staffs.filter(s => s.can_be_main_judge || s.can_be_sub_judge).length === 0}
          >
            <Icon name="gavel" size={18} />
            <span className="ml-2">{assigningJudges ? "割り当て中..." : "審判の自動割り当て"}</span>
          </Button>
          {matches.length === 0 && (
            <p className="text-xs text-center text-muted-foreground mt-1">
              先に試合の組み合わせを生成してください
            </p>
          )}
        </div>
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
        ) : filteredDisplayMatches.length === 0 ? (
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
              const segMatches = filteredDisplayMatches.filter((m) => m.event_timetable_segment_id === seg.id);
              return { seg, matches: segMatches };
            })
            .filter((item) => item.matches.length > 0)
            .map(({ seg, matches: segMatches }) => {
              // Count staff assignments across all matches in this segment to detect duplicate booking
              const segmentStaffAssignments: Record<number, number> = {};
              segMatches.forEach((m) => {
                [
                  m.main_judge_staff_id,
                  m.sub_judge1_staff_id,
                  m.sub_judge2_staff_id,
                  m.sub_judge3_staff_id,
                  m.sub_judge4_staff_id,
                  m.timekeeper_staff_id,
                ].forEach((id) => {
                  if (id) {
                    segmentStaffAssignments[id] = (segmentStaffAssignments[id] || 0) + 1;
                  }
                });
              });

              const getUnassignedStaffs = () => {
                const assigned = new Set<number>([
                  ...segMatches.map((m) => m.main_judge_staff_id),
                  ...segMatches.map((m) => m.sub_judge1_staff_id),
                  ...segMatches.map((m) => m.sub_judge2_staff_id),
                  ...segMatches.map((m) => m.sub_judge3_staff_id),
                  ...segMatches.map((m) => m.sub_judge4_staff_id),
                  ...segMatches.map((m) => m.timekeeper_staff_id),
                ].filter((id): id is number => id != null));
                const list = staffs.filter((s) => {
                  const isPresentInSeg =
                    s.present_segment_ids.length === 0 || s.present_segment_ids.includes(seg.id);
                  if (!isPresentInSeg) return false;
                  if (assigned.has(s.id)) return false;
                  return true;
                });
                return list.sort((a, b) => {
                  const hasRoleA = a.can_be_main_judge || a.can_be_sub_judge || a.can_be_timekeeper;
                  const hasRoleB = b.can_be_main_judge || b.can_be_sub_judge || b.can_be_timekeeper;
                  if (hasRoleA && !hasRoleB) return -1;
                  if (!hasRoleA && hasRoleB) return 1;
                  return 0;
                });
              };

              return (
                <Card key={seg.id} className="relative overflow-visible border-border/80 shadow-sm">
                  <CardHeader className="bg-muted/30 border-b border-border/60 py-3 flex flex-row items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1 rounded bg-secondary/80 text-muted-foreground"><Icon name="schedule" size={16} /></div>
                      <span className="font-bold text-sm text-foreground">{seg.name}</span>
                      {seg.start_time && (
                        <span className="text-xs text-muted-foreground bg-white px-2 py-0.5 border border-border rounded-full font-medium">
                          {seg.start_time}〜
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setUnassignedStaffSegId(seg.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 text-xs font-semibold hover:bg-amber-100 transition-colors"
                      >
                        <Icon name="person_off" size={14} />
                        未割当スタッフ
                      </button>
                      <label className={`flex items-center gap-1.5 text-xs font-semibold select-none text-muted-foreground ${segMatches.some(m => m.id < 0) ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:text-foreground'}`}>
                        <input
                          type="checkbox"
                          checked={segMatches.length > 0 && segMatches.every((m) => m.is_staffs_fixed)}
                          disabled={segMatches.some(m => m.id < 0)}
                          onChange={(e) => handleToggleSegmentLock(seg.id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-primary cursor-pointer disabled:cursor-not-allowed"
                        />
                        <span>配置を確定する</span>
                      </label>
                      <Badge variant="outline" className="bg-white border-border/80 text-xs font-semibold">{segMatches.length} 試合</Badge>
                    </div>
                  </CardHeader>

                  {/* 未割当スタッフ モーダル */}
                  {unassignedStaffSegId === seg.id && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setUnassignedStaffSegId(null)}>
                      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon name="person_off" size={22} className="text-amber-600" />
                            <h3 className="font-bold text-base">未割当スタッフ — {seg.name}</h3>
                          </div>
                          <button onClick={() => setUnassignedStaffSegId(null)} className="p-1.5 rounded-lg hover:bg-muted">
                            <Icon name="close" size={20} className="text-muted-foreground" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          この時間枠に稼働可能な、割り当てられていないスタッフの一覧です。
                        </p>
                        
                        {/* 一覧 */}
                        {(() => {
                          const list = getUnassignedStaffs();
                          if (list.length === 0) {
                            return (
                              <div className="py-8 text-center text-muted-foreground text-sm">
                                <Icon name="check_circle" size={32} className="text-green-500 mx-auto mb-2" />
                                <p>全員が割り当て済みです</p>
                              </div>
                            );
                          }
                          return (
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                              {list.map((s) => (
                                <div key={s.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted/20">
                                  <div className="p-1.5 rounded-full bg-amber-100">
                                    <Icon name="person" size={16} className="text-amber-600" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-semibold text-sm">{s.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {[s.can_be_main_judge && "主審可", s.can_be_sub_judge && "副審可", s.can_be_timekeeper && "タイムキーパー可"]
                                        .filter(Boolean).join(" / ")}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                        <Button variant="outlined" size="sm" className="w-full" onClick={() => setUnassignedStaffSegId(null)}>
                          閉じる
                        </Button>
                      </div>
                    </div>
                  )}

                  <CardContent className="p-0 bg-slate-50/30">
                    {/* Responsive View (Insuficient width / Mobile / Tablet) */}
                    <div className="xl:hidden divide-y divide-border/60">
                      {segMatches.map((m) => {
                        return (
                          <div key={m.id} className="p-4 space-y-3 bg-white hover:bg-slate-50/50 transition-colors">
                            {/* Row 1: 会場 部門 肯定側 vs 否定側 */}
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/30 pb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-foreground whitespace-nowrap">
                                  {m.room_name ?? <span className="italic text-xs text-muted-foreground">未割当</span>}
                                </span>
                                {m.section_name && (
                                  <span title={m.section_name}>
                                    <span className="inline-flex items-center justify-center rounded-full border border-primary/30 text-primary bg-transparent text-[10px] font-medium w-[6.2em] h-[18px] px-1">
                                      <span className="truncate text-center w-full">{m.section_name}</span>
                                    </span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-sm font-semibold">
                                <span className="text-foreground max-w-[120px] truncate">{m.aff_team_name ?? "-"}</span>
                                <span className="text-xs text-muted-foreground/50 font-normal">vs</span>
                                <span className="text-foreground max-w-[120px] truncate">{m.neg_team_name ?? "-"}</span>
                              </div>
                            </div>

                            {/* Row 2: 審判 司会タイマー 状態 変更 */}
                            <div className="flex flex-wrap items-end justify-between gap-4 pt-1">
                              <div className="flex flex-wrap gap-x-6 gap-y-2">
                                {/* Referees */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">審判</p>
                                  {renderJudges(m, segmentStaffAssignments, seg)}
                                </div>
                                {/* Timekeeper */}
                                <div className="space-y-1">
                                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">司会タイマー</p>
                                  <div>
                                    {renderSlot(m, 'timekeeper', '計', segmentStaffAssignments, seg)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-5 ml-auto">
                                {/* Status */}
                                <div className="text-center">
                                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mb-1">状態</p>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${m.is_result_confirmed ? "text-green-600 bg-green-50" : "text-muted-foreground bg-secondary/30"}`}>
                                    {m.is_result_confirmed ? "完" : "未"}
                                  </span>
                                </div>
                                {/* Change Edit */}
                                <div className="text-center">
                                  <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider mb-0.5">変更</p>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1.5 h-auto rounded-full text-primary hover:bg-primary/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                                    onClick={() => openEdit(m)}
                                    disabled={m.is_staffs_fixed}
                                  >
                                    <Icon name="tune" size={18} />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Desktop View (Standard Table) */}
                    <div className="hidden xl:block">
                      <Table className="border-none rounded-none" wrapperClassName="overflow-visible border-none rounded-none">
                        <TableHeader>
                          <TableRow hover={false}>
                            <TableHead className="pl-4 whitespace-nowrap w-fit">会場</TableHead>
                            <TableHead className="w-[80px]">部門</TableHead>
                            <TableHead>肯定側</TableHead>
                            <TableHead align="center" className="text-center w-12">VS</TableHead>
                            <TableHead>否定側</TableHead>
                            <TableHead className="w-[300px] min-w-[300px]">審判</TableHead>
                            <TableHead className="w-[165px] min-w-[165px]">司会タイマー</TableHead>
                            <TableHead align="center" className="text-center w-20">状態</TableHead>
                            <TableHead align="right" className="pr-4 text-right w-16">変更</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {segMatches.map((m) => {
                            return (
                              <TableRow key={m.id}>
                                <TableCell className="text-sm font-medium pl-4 whitespace-nowrap w-fit">{m.room_name ?? <span className="italic text-xs text-muted-foreground">未割当</span>}</TableCell>
                                <TableCell>
                                  {m.section_name
                                    ? (
                                      <span title={m.section_name}>
                                        <span className="inline-flex items-center justify-center rounded-full border border-primary/30 text-primary bg-transparent text-[10px] font-medium w-[6.2em] h-[18px] px-1">
                                          <span className="truncate text-center w-full">{m.section_name}</span>
                                        </span>
                                      </span>
                                    )
                                    : null}
                                </TableCell>
                                <TableCell className="font-semibold text-sm">{m.aff_team_name ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                                <TableCell align="center" className="text-center font-bold text-xs text-muted-foreground/60 w-12">VS</TableCell>
                                <TableCell className="font-semibold text-sm">{m.neg_team_name ?? <span className="text-muted-foreground text-xs">-</span>}</TableCell>
                                <TableCell className="py-2.5">{renderJudges(m, segmentStaffAssignments, seg)}</TableCell>
                                <TableCell className="py-2.5">
                                  {renderSlot(m, 'timekeeper', '計', segmentStaffAssignments, seg)}
                                </TableCell>
                                <TableCell align="center" className="text-center w-20">
                                  <span className={`text-xs font-bold ${m.is_result_confirmed ? "text-green-600" : "text-muted-foreground"}`}>
                                    {m.is_result_confirmed ? "完" : "未"}
                                  </span>
                                </TableCell>
                                <TableCell align="right" className="pr-4 text-right w-16">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="p-1.5 h-auto rounded-full text-primary hover:bg-primary/5 active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                                    onClick={() => openEdit(m)}
                                    disabled={m.is_staffs_fixed}
                                  >
                                    <Icon name="tune" size={18} />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })
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
                  {filteredTeamsForModal.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">否定側チーム</label>
                <select value={editForm.neg_team_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, neg_team_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {filteredTeamsForModal.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
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
                <label className="text-sm font-medium">副審3</label>
                <select value={editForm.sub_judge3_staff_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, sub_judge3_staff_id: e.target.value } : f)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary focus:outline-none">
                  <option value="">未設定</option>
                  {judgeStaffs.map((s) => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">副審4</label>
                <select value={editForm.sub_judge4_staff_id}
                  onChange={(e) => setEditForm((f) => f ? { ...f, sub_judge4_staff_id: e.target.value } : f)}
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
