/**
 * Event API client functions
 */

// Read build-time injected value explicitly so Next.js replaces it at build time.
const BUILD_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL as string | undefined;

function getApiBaseUrl(): string {
  // First prefer the compile-time injected value.
  if (BUILD_API_BASE_URL) return BUILD_API_BASE_URL;

  // Fallback to a runtime-injected global (set via Dockerfile ENV or window).
  const runtimeUrl = (globalThis as any)?.NEXT_PUBLIC_API_URL || (globalThis as any)?.window?.NEXT_PUBLIC_API_URL;
  if (runtimeUrl) return runtimeUrl as string;

  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

export interface Event {
  id: number;
  name: string;
  start_date: string | null;
  spreadsheet_id: string | null;
  bucket_name: string | null;
  flash_news_url: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EventCreate {
  name: string;
  start_date?: string | null;
  spreadsheet_id?: string | null;
  bucket_name?: string | null;
  flash_news_url?: string | null;
}

export async function fetchEvents(): Promise<Event[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/events`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.statusText}`);
  }

  return response.json();
}

export async function getEventById(eventId: number): Promise<Event> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/events/${eventId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch event: ${response.statusText}`);
  }

  return response.json();
}

export async function createEvent(eventData: EventCreate): Promise<Event> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventData),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to create event: ${response.statusText}`);
  }

  return response.json();
}

export async function updateEvent(eventId: number, eventData: Partial<EventCreate>): Promise<Event> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/events/${eventId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(eventData),
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to update event: ${response.statusText}`);
  }

  return response.json();
}

export async function deleteEvent(eventId: number): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/events/${eventId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to delete event: ${response.statusText}`);
  }
}
