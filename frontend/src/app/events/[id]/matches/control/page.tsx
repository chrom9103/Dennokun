"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

        // Initialize parallel matches per segment if not set
        setParallelMatches((prev) => {
          const next = { ...prev };
          segsData.forEach((s) => {
            if (next[s.id] === undefined) {
              const segMatches = matchesData.filter(m => m.event_timetable_segment_id === s.id);
              if (segMatches.length > 0) {
                next[s.id] = segMatches.length;
              } else {
                next[s.id] = Math.min(2, roomsData.length || 2);
              }
            }
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

  // Filter matches
  const filteredMatches = matches.filter((m) => {
    const matchSeg = fSegment === "all" || String(m.event_timetable_segment_id) === fSegment;
    const matchSec = fSection === "all" || String(m.event_section_id) === fSection;
    return matchSeg && matchSec;
  });

  async function handleGenerate() {
    if (!eventId) return;
    if (matches.length > 0) {
      if (!confirm("確定されていない試合を削除して再生成します。よろしいですか？")) return;
    }
    setGenerating(true);
    setGenResult(null);
    setJudgeResult(null);
    setError(null);
    try {
      const req: GenerateMatchesRequest = {
        segment_parallel_matches: parallelMatches,
        overwrite: false,
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

  const [activeDropdown, setActiveDropdown] = useState<{ matchId: number; role: 'main' | 'sub1' | 'sub2' | 'timekeeper' } | null>(null);
  const [isParamsOpen, setIsParamsOpen] = useState(false);

  const [dragOverTarget, setDragOverTarget] = useState<{ matchId: number; role: 'main' | 'sub1' | 'sub2' | 'timekeeper' } | null>(null);

  function handleDragStart(e: React.DragEvent, matchId: number, role: 'main' | 'sub1' | 'sub2' | 'timekeeper') {
    e.dataTransfer.setData("text/plain", JSON.stringify({ matchId, role }));
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent, isLocked: boolean) {
    if (isLocked) return;
    e.preventDefault();
  }

  function handleDragEnter(e: React.DragEvent, matchId: number, role: 'main' | 'sub1' | 'sub2' | 'timekeeper', isLocked: boolean) {
    if (isLocked) return;
    e.preventDefault();
    setDragOverTarget({ matchId, role });
  }

  function handleDragLeave() {
    setDragOverTarget(null);
  }

  async function handleDrop(e: React.DragEvent, targetMatchId: number, targetRole: 'main' | 'sub1' | 'sub2' | 'timekeeper', targetLocked: boolean) {
    e.preventDefault();
    setDragOverTarget(null);
    if (targetLocked) return;

    try {
      const dataStr = e.dataTransfer.getData("text/plain");
      if (!dataStr) return;
      const { matchId: sourceMatchId, role: sourceRole } = JSON.parse(dataStr) as {
        matchId: number;
        role: 'main' | 'sub1' | 'sub2' | 'timekeeper';
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
                           sourceMatch.timekeeper_staff_id;

      const targetStaffId = targetRole === 'main' ? targetMatch.main_judge_staff_id :
                           targetRole === 'sub1' ? targetMatch.sub_judge1_staff_id :
                           targetRole === 'sub2' ? targetMatch.sub_judge2_staff_id :
                           targetMatch.timekeeper_staff_id;

      // Optimistic local update
      setMatches((prev) =>
        prev.map((m) => {
          if (m.id === sourceMatchId && m.id === targetMatchId) {
            const updated = { ...m };
            const sourceKey = sourceRole === 'main' ? 'main_judge_staff_id' :
                              sourceRole === 'sub1' ? 'sub_judge1_staff_id' :
                              sourceRole === 'sub2' ? 'sub_judge2_staff_id' :
                              'timekeeper_staff_id';
            const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                              targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                              targetRole === 'sub2' ? 'sub_judge2_staff_id' :
                              'timekeeper_staff_id';
            updated[sourceKey] = targetStaffId;
            updated[targetKey] = sourceStaffId;
            return updated;
          } else if (m.id === sourceMatchId) {
            const updated = { ...m };
            const sourceKey = sourceRole === 'main' ? 'main_judge_staff_id' :
                              sourceRole === 'sub1' ? 'sub_judge1_staff_id' :
                              sourceRole === 'sub2' ? 'sub_judge2_staff_id' :
                              'timekeeper_staff_id';
            updated[sourceKey] = targetStaffId;
            return updated;
          } else if (m.id === targetMatchId) {
            const updated = { ...m };
            const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                              targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                              targetRole === 'sub2' ? 'sub_judge2_staff_id' :
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
                          'timekeeper_staff_id';
        const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                          targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                          targetRole === 'sub2' ? 'sub_judge2_staff_id' :
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
                          'timekeeper_staff_id';
        const targetKey = targetRole === 'main' ? 'main_judge_staff_id' :
                          targetRole === 'sub1' ? 'sub_judge1_staff_id' :
                          targetRole === 'sub2' ? 'sub_judge2_staff_id' :
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
      if (role === 'timekeeper') update.timekeeper_staff_id = staffId;

      await updateMatchAssignment(eventId, matchId, update);
      await load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "更新に失敗しました");
      await load();
    }
  }

  const getSortedCandidates = (match: MatchListItem, role: 'main' | 'sub1' | 'sub2' | 'timekeeper', segmentStaffAssignments: Record<number, number>, seg: any) => {
    const candidates = staffs.filter((s) => {
      if (role === 'timekeeper') return s.can_be_timekeeper;
      if (role === 'main') return s.can_be_main_judge;
      return s.can_be_sub_judge;
    });

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
    const pastSegments = sortedSegments.slice(0, currentSegIdx);
    const pastSegmentIds = new Set(pastSegments.map((s) => s.id));
    const pastMatches = matches.filter((pastM) => pastM.event_timetable_segment_id !== null && pastSegmentIds.has(pastM.event_timetable_segment_id));

    return candidates.map((staff) => {
      const isDuplicate = matches.some((m) => {
        if (m.event_timetable_segment_id === match.event_timetable_segment_id) {
          if (m.id !== match.id) {
            return m.main_judge_staff_id === staff.id ||
                   m.sub_judge1_staff_id === staff.id ||
                   m.sub_judge2_staff_id === staff.id ||
                   m.timekeeper_staff_id === staff.id;
          } else {
            return (role !== 'main' && m.main_judge_staff_id === staff.id) ||
                   (role !== 'sub1' && m.sub_judge1_staff_id === staff.id) ||
                   (role !== 'sub2' && m.sub_judge2_staff_id === staff.id) ||
                   (role !== 'timekeeper' && m.timekeeper_staff_id === staff.id);
          }
        }
        return false;
      });

      const isSchoolConflict = !!(
        (affSchoolId && staff.interested_school_ids?.includes(affSchoolId)) ||
        (negSchoolId && staff.interested_school_ids?.includes(negSchoolId))
      );

      const seenSchoolsInPast = new Set<number>();
      pastMatches.forEach((pastM) => {
        const isAssigned = (
          pastM.main_judge_staff_id === staff.id ||
          pastM.sub_judge1_staff_id === staff.id ||
          pastM.sub_judge2_staff_id === staff.id ||
          pastM.timekeeper_staff_id === staff.id
        );
        if (isAssigned && pastM.event_section_id === match.event_section_id) {
          const pastAffTeam = teams.find((t) => t.id === pastM.aff_team_id);
          const pastNegTeam = teams.find((t) => t.id === pastM.neg_team_id);
          if (pastAffTeam?.event_school_id) seenSchoolsInPast.add(pastAffTeam.event_school_id);
          if (pastNegTeam?.event_school_id) seenSchoolsInPast.add(pastNegTeam.event_school_id);
        }
      });

      const hasSeenSameSchoolInPast = !!(
        (affSchoolId && seenSchoolsInPast.has(affSchoolId)) ||
        (negSchoolId && seenSchoolsInPast.has(negSchoolId))
      );

      let category = 0;
      if (isDuplicate) category = 3;
      else if (isSchoolConflict) category = 2;
      else if (hasSeenSameSchoolInPast) category = 1;

      return { staff, category };
    }).sort((a, b) => {
      if (a.category !== b.category) {
        return a.category - b.category;
      }
      return a.staff.id - b.staff.id;
    });
  };

  const renderSlot = (match: MatchListItem, role: 'main' | 'sub1' | 'sub2' | 'timekeeper', label: string, segmentStaffAssignments: Record<number, number>, seg: any) => {
    const staffId = role === 'main' ? match.main_judge_staff_id :
                    role === 'sub1' ? match.sub_judge1_staff_id :
                    role === 'sub2' ? match.sub_judge2_staff_id :
                    match.timekeeper_staff_id;

    const staff = staffs.find((s) => s.id === staffId);
    const isLocked = match.is_staffs_fixed;

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

      const sortedSegments = [...segments].sort((a, b) => {
        if (a.order_number !== b.order_number) {
          return (a.order_number ?? 0) - (b.order_number ?? 0);
        }
        return a.id - b.id;
      });

      const currentSegIdx = sortedSegments.findIndex((s) => s.id === match.event_timetable_segment_id);
      const pastSegments = sortedSegments.slice(0, currentSegIdx);
      const pastSegmentIds = new Set(pastSegments.map((s) => s.id));
      const pastMatches = matches.filter((pastM) => pastM.event_timetable_segment_id !== null && pastSegmentIds.has(pastM.event_timetable_segment_id));

      const seenSchoolsInPast = new Set<number>();
      pastMatches.forEach((pastM) => {
        const isAssigned = (
          pastM.main_judge_staff_id === staff.id ||
          pastM.sub_judge1_staff_id === staff.id ||
          pastM.sub_judge2_staff_id === staff.id ||
          pastM.timekeeper_staff_id === staff.id
        );
        if (isAssigned && pastM.event_section_id === match.event_section_id) {
          const pastAffTeam = teams.find((t) => t.id === pastM.aff_team_id);
          const pastNegTeam = teams.find((t) => t.id === pastM.neg_team_id);
          if (pastAffTeam?.event_school_id) seenSchoolsInPast.add(pastAffTeam.event_school_id);
          if (pastNegTeam?.event_school_id) seenSchoolsInPast.add(pastNegTeam.event_school_id);
        }
      });

      hasSeenSameSchoolInPast = !!(
        (affSchoolId && seenSchoolsInPast.has(affSchoolId)) ||
        (negSchoolId && seenSchoolsInPast.has(negSchoolId))
      );

      chipClass = "bg-secondary/20 border-border/80 text-foreground font-medium";
      if (isDuplicate) {
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
                const candColorClass = cand.category === 3 ? "bg-red-50 text-red-700 hover:bg-red-100" :
                                       cand.category === 2 ? "bg-amber-50 text-amber-700 hover:bg-amber-100" :
                                       cand.category === 1 ? "bg-blue-50 text-blue-700 hover:bg-blue-100" :
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
                    {cand.category > 0 && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-white/60 border border-current shrink-0">
                        {cand.category === 3 ? "重複" : cand.category === 2 ? "関係校" : "過去"}
                      </span>
                    )}
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

    const elements = [];
    if (expectedJudgeCount >= 1) {
      elements.push(renderSlot(m, 'main', '主', segmentStaffAssignments, seg));
    }
    if (expectedJudgeCount >= 2) {
      elements.push(renderSlot(m, 'sub1', '副', segmentStaffAssignments, seg));
    }
    if (expectedJudgeCount >= 3) {
      elements.push(renderSlot(m, 'sub2', '副', segmentStaffAssignments, seg));
    }

    return (
      <div className="grid grid-cols-2 gap-1.5 w-fit">
        {elements}
      </div>
    );
  };

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
                  <TableHead align="center" className="w-1/3 text-center">各枠の並行試合数設定</TableHead>
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
                    
                    {/* Parallel Matches Column */}
                    <TableCell align="center" className="py-3">
                      <div className="inline-flex items-center gap-1 bg-white border border-border rounded-lg p-0.5 shadow-sm">
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
            {/* Card Footer with actions */}
            <div className="border-t border-border p-4 bg-secondary/5 space-y-4">
              {/* Action Buttons Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Button
                    className="w-full font-semibold"
                    onClick={handleGenerate}
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
            </div>
          </CardContent>
        )}
      </Card>

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
            .map(({ seg, matches: segMatches }) => {
              // Count staff assignments across all matches in this segment to detect duplicate booking
              const segmentStaffAssignments: Record<number, number> = {};
              segMatches.forEach((m) => {
                [
                  m.main_judge_staff_id,
                  m.sub_judge1_staff_id,
                  m.sub_judge2_staff_id,
                  m.timekeeper_staff_id,
                ].forEach((id) => {
                  if (id) {
                    segmentStaffAssignments[id] = (segmentStaffAssignments[id] || 0) + 1;
                  }
                });
              });

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
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold select-none text-muted-foreground hover:text-foreground">
                        <input
                          type="checkbox"
                          checked={segMatches.length > 0 && segMatches.every((m) => m.is_staffs_fixed)}
                          onChange={(e) => handleToggleSegmentLock(seg.id, e.target.checked)}
                          className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                        />
                        <span>配置を確定する</span>
                      </label>
                      <Badge variant="outline" className="bg-white border-border/80 text-xs font-semibold">{segMatches.length} 試合</Badge>
                    </div>
                  </CardHeader>
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
