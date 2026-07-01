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
