/**
 * Match and standings API client
 */

const BUILD_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL as string | undefined;

function getApiBaseUrl(): string {
  if (BUILD_API_BASE_URL) return BUILD_API_BASE_URL;
  const runtimeUrl =
    (globalThis as any)?.NEXT_PUBLIC_API_URL ||
    (globalThis as any)?.window?.NEXT_PUBLIC_API_URL;
  if (runtimeUrl) return runtimeUrl as string;
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

// ── Match list item ────────────────────────────────────────────────────────────

export interface MatchListItem {
  id: number;
  event_id: number;
  event_timetable_segment_id: number | null;
  event_room_id: number | null;
  event_section_id: number | null;
  aff_team_id: number | null;
  neg_team_id: number | null;
  aff_votes: number | null;
  neg_votes: number | null;
  aff_comm_sum: number | null;
  neg_comm_sum: number | null;
  aff_manner: number | null;
  neg_manner: number | null;
  aff_won: number | null;
  neg_won: number | null;
  is_result_confirmed: boolean;
  is_staffs_fixed: boolean;
  judges_assignment_count: number | null;
  order_number_in_segment: number | null;
  note: string | null;
  name: string | null;
  created_at: string;
  updated_at: string;
  // joined
  timetable_segment_name: string | null;
  segment_order: number | null;
  room_name: string | null;
  section_name: string | null;
  aff_team_name: string | null;
  main_judge_staff_id: number | null;
  sub_judge1_staff_id: number | null;
  sub_judge2_staff_id: number | null;
  sub_judge3_staff_id: number | null;
  sub_judge4_staff_id: number | null;
  timekeeper_staff_id: number | null;
  neg_team_name: string | null;
  timekeeper_name: string | null;
}

// ── Match voting detail ────────────────────────────────────────────────────────

export interface VotingDetail {
  id?: number;
  event_match_id?: number;
  judge_index: number;
  aff_won: number;
  neg_won: number;
  aff_constructive_comm: number;
  aff_question_comm: number;
  aff_answer_comm: number;
  aff_first_rebuttal_comm: number;
  aff_second_rebuttal_comm: number;
  neg_constructive_comm: number;
  neg_question_comm: number;
  neg_answer_comm: number;
  neg_first_rebuttal_comm: number;
  neg_second_rebuttal_comm: number;
  aff_comm_sum: number;
  neg_comm_sum: number;
  aff_manner: number;
  neg_manner: number;
  note: string | null;
}

// ── Match detail ───────────────────────────────────────────────────────────────

export interface MatchDetail extends MatchListItem {
  aff_constructive_comm: number | null;
  aff_question_comm: number | null;
  aff_answer_comm: number | null;
  aff_first_rebuttal_comm: number | null;
  aff_second_rebuttal_comm: number | null;
  neg_constructive_comm: number | null;
  neg_question_comm: number | null;
  neg_answer_comm: number | null;
  neg_first_rebuttal_comm: number | null;
  neg_second_rebuttal_comm: number | null;
  is_result_public: boolean;
  is_staffs_fixed: boolean;
  main_judge_staff_id: number | null;
  sub_judge1_staff_id: number | null;
  sub_judge2_staff_id: number | null;
  sub_judge3_staff_id: number | null;
  sub_judge4_staff_id: number | null;
  timekeeper_staff_id: number | null;
  main_judge_name: string | null;
  sub_judge1_name: string | null;
  sub_judge2_name: string | null;
  sub_judge3_name: string | null;
  sub_judge4_name: string | null;
  timekeeper_name: string | null;
  start_time: string | null;
  end_time: string | null;
  voting_details: VotingDetail[];
}

// ── Result save ────────────────────────────────────────────────────────────────

export interface MatchResultSave {
  aff_votes: number;
  neg_votes: number;
  aff_comm_sum: number;
  neg_comm_sum: number;
  aff_manner: number;
  neg_manner: number;
  is_result_confirmed: boolean;
  voting_details?: VotingDetail[];
}

// ── Standings ──────────────────────────────────────────────────────────────────

export interface StandingsEntry {
  event_section_id: number | null;
  section_name: string | null;
  team_id: number;
  team_name: string;
  school_name: string | null;
  wins: number;
  losses: number;
  matches_played: number;
  total_votes: number;
  total_comm: number;
  total_manner: number;
  rank: number;
  final_rank?: number | null;
}

export interface MatchSummary {
  total: number;
  confirmed: number;
  scheduled: number;
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function fetchMatches(eventId: number): Promise<MatchListItem[]> {
  return apiFetch(`/api/events/${eventId}/matches`);
}

export async function fetchMatch(eventId: number, matchId: number): Promise<MatchDetail> {
  return apiFetch(`/api/events/${eventId}/matches/${matchId}`);
}

export async function saveMatchResult(
  eventId: number,
  matchId: number,
  data: MatchResultSave
): Promise<MatchDetail> {
  return apiFetch(`/api/events/${eventId}/matches/${matchId}/result`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function fetchStandings(eventId: number, round?: string): Promise<StandingsEntry[]> {
  const query = round ? `?round=${round}` : "";
  return apiFetch(`/api/events/${eventId}/standings${query}`);
}

export async function fetchMatchSummary(eventId: number, round?: string): Promise<MatchSummary> {
  const query = round ? `?round=${round}` : "";
  return apiFetch(`/api/events/${eventId}/match-summary${query}`);
}

export async function saveFinalStandings(
  eventId: number,
  ranks: { team_id: number; final_rank: number | null }[]
): Promise<{ status: string }> {
  return apiFetch(`/api/events/${eventId}/final-standings`, {
    method: "PUT",
    body: JSON.stringify(ranks),
  });
}
