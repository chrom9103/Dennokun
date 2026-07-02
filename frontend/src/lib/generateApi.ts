/**
 * generateApi.ts — 試合自動生成・割当更新 APIクライアント
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateMatchesRequest {
  segment_parallel_matches: Record<number, number>;
  overwrite?: boolean;
}

export interface GenerateMatchesResponse {
  generated_count: number;
  deleted_count: number;
  warnings: string[];
}

export interface MatchAssignmentUpdate {
  event_timetable_segment_id?: number | null;
  event_room_id?: number | null;
  aff_team_id?: number | null;
  neg_team_id?: number | null;
  main_judge_staff_id?: number | null;
  sub_judge1_staff_id?: number | null;
  sub_judge2_staff_id?: number | null;
  timekeeper_staff_id?: number | null;
  event_section_id?: number | null;
  order_number_in_segment?: number | null;
}

export interface DashboardSummary {
  total_matches: number;
  confirmed_matches: number;
  pending_matches: number;
  total_teams: number;
  total_staffs: number;
  total_schools: number;
  total_sections: number;
}

// ── API functions ──────────────────────────────────────────────────────────────

export async function generateMatches(
  eventId: number,
  req: GenerateMatchesRequest
): Promise<GenerateMatchesResponse> {
  return apiFetch(`/api/events/${eventId}/generate-matches`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function deleteAllMatches(eventId: number): Promise<{ deleted_count: number }> {
  return apiFetch(`/api/events/${eventId}/matches`, { method: "DELETE" });
}

export async function updateMatchAssignment(
  eventId: number,
  matchId: number,
  data: MatchAssignmentUpdate
): Promise<unknown> {
  return apiFetch(`/api/events/${eventId}/matches/${matchId}/assignment`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function fetchDashboardSummary(eventId: number): Promise<DashboardSummary> {
  return apiFetch(`/api/events/${eventId}/dashboard-summary`);
}

export async function assignJudges(
  eventId: number,
  segmentJudgeCounts: Record<number, number>
): Promise<{ status: string; updated_count: number }> {
  return apiFetch(`/api/events/${eventId}/assign-judges`, {
    method: "POST",
    body: JSON.stringify({ segment_judge_counts: segmentJudgeCounts }),
  });
}
