/**
 * Master data API client functions
 * Covers: sections, rooms, timetable segments, schools
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

// ── Section (部門) ────────────────────────────────────────────────────────────

export interface Section {
  id: number;
  event_id: number;
  name: string;
  order_number: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SectionCreate {
  name: string;
  order_number?: number | null;
}

export async function fetchSections(eventId: number): Promise<Section[]> {
  return apiFetch(`/api/events/${eventId}/sections`);
}

export async function createSection(eventId: number, data: SectionCreate): Promise<Section> {
  return apiFetch(`/api/events/${eventId}/sections`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSection(eventId: number, sectionId: number, data: Partial<SectionCreate>): Promise<Section> {
  return apiFetch(`/api/events/${eventId}/sections/${sectionId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSection(eventId: number, sectionId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/sections/${sectionId}`, { method: "DELETE" });
}

// ── Room (会場) ───────────────────────────────────────────────────────────────

export interface Room {
  id: number;
  event_id: number;
  name: string;
  order_number: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RoomCreate {
  name: string;
  order_number?: number | null;
  note?: string | null;
}

export async function fetchRooms(eventId: number): Promise<Room[]> {
  return apiFetch(`/api/events/${eventId}/rooms`);
}

export async function createRoom(eventId: number, data: RoomCreate): Promise<Room> {
  return apiFetch(`/api/events/${eventId}/rooms`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRoom(eventId: number, roomId: number, data: Partial<RoomCreate>): Promise<Room> {
  return apiFetch(`/api/events/${eventId}/rooms/${roomId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRoom(eventId: number, roomId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/rooms/${roomId}`, { method: "DELETE" });
}

// ── TimetableSegment (時間枠) ──────────────────────────────────────────────────

export interface TimetableSegment {
  id: number;
  event_id: number;
  name: string;
  order_number: number | null;
  start_time: string | null;
  end_time: string | null;
  is_pre_round: boolean;
  name_aliases: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TimetableSegmentCreate {
  name: string;
  order_number?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  is_pre_round?: boolean;
  name_aliases?: string[];
}

export async function fetchTimetableSegments(eventId: number): Promise<TimetableSegment[]> {
  return apiFetch(`/api/events/${eventId}/timetable-segments`);
}

export async function createTimetableSegment(eventId: number, data: TimetableSegmentCreate): Promise<TimetableSegment> {
  return apiFetch(`/api/events/${eventId}/timetable-segments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTimetableSegment(eventId: number, segmentId: number, data: Partial<TimetableSegmentCreate>): Promise<TimetableSegment> {
  return apiFetch(`/api/events/${eventId}/timetable-segments/${segmentId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTimetableSegment(eventId: number, segmentId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/timetable-segments/${segmentId}`, { method: "DELETE" });
}

// ── School (参加校) ────────────────────────────────────────────────────────────

export interface School {
  id: number;
  event_id: number;
  name: string;
  order_number: number | null;
  note: string | null;
  name_aliases: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SchoolCreate {
  name: string;
  order_number?: number | null;
  note?: string | null;
  name_aliases?: string[];
}

export async function fetchSchools(eventId: number): Promise<School[]> {
  return apiFetch(`/api/events/${eventId}/schools`);
}

export async function createSchool(eventId: number, data: SchoolCreate): Promise<School> {
  return apiFetch(`/api/events/${eventId}/schools`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSchool(eventId: number, schoolId: number, data: Partial<SchoolCreate>): Promise<School> {
  return apiFetch(`/api/events/${eventId}/schools/${schoolId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteSchool(eventId: number, schoolId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/schools/${schoolId}`, { method: "DELETE" });
}

// ── TeamGroup (チームグループ) ──────────────────────────────────────────────────

export interface TeamGroup {
  id: number;
  event_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export async function fetchTeamGroups(eventId: number): Promise<TeamGroup[]> {
  return apiFetch(`/api/events/${eventId}/team-groups`);
}

export async function createTeamGroup(eventId: number, name: string): Promise<TeamGroup> {
  return apiFetch(`/api/events/${eventId}/team-groups`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateTeamGroup(eventId: number, groupId: number, name: string): Promise<TeamGroup> {
  return apiFetch(`/api/events/${eventId}/team-groups/${groupId}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteTeamGroup(eventId: number, groupId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/team-groups/${groupId}`, { method: "DELETE" });
}

// ── Team (チーム) ─────────────────────────────────────────────────────────────

export interface Team {
  id: number;
  event_id: number;
  name: string;
  event_section_id: number | null;
  event_school_id: number | null;
  team_group_id: number | null;
  is_seed: boolean;
  order_of_application: number | null;
  note: string | null;
  section_name: string | null;
  school_name: string | null;
  group_name: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TeamCreate {
  name: string;
  event_section_id?: number | null;
  event_school_id?: number | null;
  team_group_id?: number | null;
  is_seed?: boolean;
  order_of_application?: number | null;
  note?: string | null;
}

export async function fetchTeams(eventId: number): Promise<Team[]> {
  return apiFetch(`/api/events/${eventId}/teams`);
}

export async function createTeam(eventId: number, data: TeamCreate): Promise<Team> {
  return apiFetch(`/api/events/${eventId}/teams`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTeam(eventId: number, teamId: number, data: Partial<TeamCreate>): Promise<Team> {
  return apiFetch(`/api/events/${eventId}/teams/${teamId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTeam(eventId: number, teamId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/teams/${teamId}`, { method: "DELETE" });
}

// ── Staff (スタッフ) ────────────────────────────────────────────────────────────

export interface Staff {
  id: number;
  event_id: number;
  name: string;
  can_be_main_judge: boolean;
  can_be_sub_judge: boolean;
  can_be_timekeeper: boolean;
  order_of_application: number | null;
  note: string | null;
  interested_school_ids: number[];
  interested_school_names: string[];
  present_segment_ids: number[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface StaffCreate {
  name: string;
  can_be_main_judge?: boolean;
  can_be_sub_judge?: boolean;
  can_be_timekeeper?: boolean;
  order_of_application?: number | null;
  note?: string | null;
  interested_school_ids?: number[];
  present_segment_ids?: number[];
}

export async function fetchStaffs(eventId: number): Promise<Staff[]> {
  return apiFetch(`/api/events/${eventId}/staffs`);
}

export async function createStaff(eventId: number, data: StaffCreate): Promise<Staff> {
  return apiFetch(`/api/events/${eventId}/staffs`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateStaff(eventId: number, staffId: number, data: Partial<StaffCreate>): Promise<Staff> {
  return apiFetch(`/api/events/${eventId}/staffs/${staffId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteStaff(eventId: number, staffId: number): Promise<void> {
  await apiFetch(`/api/events/${eventId}/staffs/${staffId}`, { method: "DELETE" });
}
