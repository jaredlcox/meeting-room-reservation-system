const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(^|;\\s*)(${name})=([^;]*)`));
  return match ? decodeURIComponent(match[3]!) : null;
}

let csrfReady = false;

async function ensureCsrf(): Promise<void> {
  if (csrfReady) return;
  await fetch(`${API_URL}/sanctum/csrf-cookie`, { credentials: "include" });
  csrfReady = true;
}

async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();

  if (method !== "GET" && method !== "HEAD") {
    await ensureCsrf();
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (method !== "GET" && method !== "HEAD") {
    const xsrf = getCookie("XSRF-TOKEN");
    if (xsrf) {
      headers["X-XSRF-TOKEN"] = xsrf;
    }
  }

  return fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

export function apiGet(path: string): Promise<Response> {
  return apiRequest(path);
}

export function apiPost(
  path: string,
  body?: unknown
): Promise<Response> {
  return apiRequest(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete(path: string): Promise<Response> {
  return apiRequest(path, { method: "DELETE" });
}

export { API_URL };
