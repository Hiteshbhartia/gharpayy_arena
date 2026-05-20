// HTTP client for the self-hosted Arena API (VITE_API_URL, e.g. http://localhost:4000/api).

const API_URL = import.meta.env.VITE_API_URL as string | undefined;
const TOKEN_KEY = "arena_token";
const USER_KEY = "arena_user";

export const apiEnabled = Boolean(API_URL);

export type ApiUser = {
  id: string;
  email: string;
  employeeId?: string;
  role: "admin" | "hr" | "manager" | "employee";
  isApproved: boolean;
  isSuspended?: boolean;
  status: "pending" | "configured" | "active" | "suspended" | "rejected";
};

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getCachedUser(): ApiUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as ApiUser) : null;
  } catch {
    return null;
  }
}

export function setCachedUser(user: ApiUser | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(USER_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function clearSession() {
  setToken(null);
  setCachedUser(null);
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!API_URL) throw new ApiError(0, "API is not configured (set VITE_API_URL)");

  const token = getToken();
  const fullUrl = `${API_URL}${path}`;

  if (import.meta.env.DEV) {
    console.debug(`[api] ${method} ${fullUrl}`);
  }

  const res = await fetch(fullUrl, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;

    if (import.meta.env.DEV) {
      console.warn(`[api] ${method} ${fullUrl} → ${res.status}`, data);
    }

    throw new ApiError(res.status, msg, data);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export async function signup(input: {
  email: string;
  password: string;
  name: string;
  employeeId?: string;
}) {
  return api.post<{ token?: string; user?: ApiUser; message?: string }>("/auth/signup", input);
}

export async function login(input: { email: string; password: string }) {
  const res = await api.post<{ token: string; user: ApiUser }>("/auth/login", input);
  setToken(res.token);
  setCachedUser(res.user);
  return res;
}

export async function me() {
  return api.get<{ user: ApiUser }>("/auth/me");
}

export function applySession(token: string, user: ApiUser) {
  setToken(token);
  setCachedUser(user);
}

export function logout() {
  clearSession();
}

export async function health() {
  return api.get<{ ok: boolean; db: string; ts: number }>("/health");
}
