/**
 * When using a separate Laravel API backend, set NEXT_PUBLIC_API_URL (e.g. http://localhost:8000).
 * All API fetch calls should use apiUrl() to prefix paths.
 */

const API_BASE = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "")
  : (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export function getApiBaseUrl(): string {
  return API_BASE;
}

/** True when the app is configured to use the external Laravel API */
export function useLaravelApi(): boolean {
  return !!API_BASE;
}

/** Full URL for an API path (e.g. /api/rooms/canvass/schedule) */
export function apiUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}
