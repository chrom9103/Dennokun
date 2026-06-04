/**
 * Authentication utilities for cookie-based auth and API calls
 */

// Read build-time injected value explicitly so Next.js replaces it at build time.
// Keep this as a direct `process.env` access so Next injects the value into the client bundle.
const BUILD_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL as string | undefined;

function getApiBaseUrl(): string {
  // First prefer the compile-time injected value.
  if (BUILD_API_BASE_URL) return BUILD_API_BASE_URL;

  // Fallback to a runtime-injected global (set via Dockerfile ENV or window).
  const runtimeUrl = (globalThis as any)?.NEXT_PUBLIC_API_URL || (globalThis as any)?.window?.NEXT_PUBLIC_API_URL;
  if (runtimeUrl) return runtimeUrl as string;

  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

const CSRF_COOKIE_NAME = "csrf_token";

export interface LoginResponse {
  message: string;
  token_type: string;
  expires_in: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  remember_me?: boolean;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookieParts = document.cookie.split("; ");
  for (const part of cookieParts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const cookieName = part.slice(0, separatorIndex);
    if (cookieName === name) {
      return decodeURIComponent(part.slice(separatorIndex + 1));
    }
  }

  return null;
}

export function getCsrfToken(): string | null {
  return getCookie(CSRF_COOKIE_NAME);
}

/**
 * Check if a session hint cookie exists.
 */
export function isAuthenticated(): boolean {
  return getCsrfToken() !== null;
}

export async function authenticatedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();

  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

/**
 * Login API call
 */
export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "ログインに失敗しました");
  }

  return response.json();
}

/**
 * Logout using the CSRF-protected logout endpoint.
 */
export async function logout(): Promise<void> {
  const response = await authenticatedFetch(`${getApiBaseUrl()}/auth/logout`, {
    method: "POST",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "ログアウトに失敗しました");
  }
}
