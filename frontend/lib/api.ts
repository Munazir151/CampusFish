import { CATEGORY_META } from "./types";
import type {
  AgentRun,
  AppConfig,
  AskResponse,
  Category,
  Circular,
  Health,
  ScanGroup,
  Source,
  Stats,
  User,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const api = {
  config: () => request<AppConfig>("/api/config"),
  health: () => request<Health>("/api/health"),
  stats: () => request<Stats>("/api/stats"),

  circulars: (params: { category?: string; urgency?: string; q?: string; limit?: number } = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== "") query.set(key, String(value));
    });
    return request<{ items: Circular[]; count: number }>(`/api/circulars?${query.toString()}`);
  },
  deadlines: () => request<{ items: Circular[]; count: number }>("/api/deadlines"),

  sources: () => request<{ items: Source[] }>("/api/sources"),
  createSource: (payload: { name: string; url: string; institution?: string; goal?: string }) =>
    request<Source>("/api/sources", { method: "POST", body: JSON.stringify(payload) }),
  updateSource: (id: string, payload: Record<string, unknown>) =>
    request<Source>(`/api/sources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  deleteSource: (id: string) => request<{ deleted: boolean }>(`/api/sources/${id}`, { method: "DELETE" }),

  scan: () => request<{ scan_id: string; status: string }>("/api/scan", { method: "POST" }),
  scanStatus: (id: string) => request<ScanGroup>(`/api/scan/${id}`),
  recentScans: () => request<{ items: ScanGroup[] }>("/api/scans"),
  agentRun: (runId: string) => request<AgentRun>(`/api/agent/runs/${runId}`),
  cancelAgentRun: (runId: string) =>
    request<{ run_id: string; status?: string }>(`/api/agent/runs/${runId}/cancel`, { method: "POST" }),
  cancelScan: (scanId: string) =>
    request<{ scan_id: string; cancelled_agents: number; errors: string[] }>(
      `/api/scan/${scanId}/cancel`,
      { method: "POST" },
    ),

  me: (userId?: string) =>
    request<User>(`/api/users/me${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`),
  createUser: (payload: Partial<User> & { name: string }) =>
    request<User>("/api/users", { method: "POST", body: JSON.stringify(payload) }),
  updateUser: (id: string, payload: Partial<User>) =>
    request<User>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  userAlerts: (id: string) => request<{ items: Circular[]; count: number }>(`/api/users/${id}/alerts`),
  linkTelegram: (id: string, chatId: string) =>
    request<{ linked: boolean }>(`/api/users/${id}/telegram`, {
      method: "POST",
      body: JSON.stringify({ chat_id: chatId }),
    }),
  testTelegram: (id: string) =>
    request<{ sent: boolean }>(`/api/users/${id}/telegram/test`, { method: "POST" }),

  injectDemo: () => request<Circular & { alerts_created: number; duplicate: boolean }>("/api/demo/inject", {
    method: "POST",
    body: JSON.stringify({}),
  }),

  ask: (question: string, userId?: string) =>
    request<AskResponse>("/api/ask", {
      method: "POST",
      body: JSON.stringify({ question, user_id: userId }),
    }),
};

export function categoryLabel(category: Category): string {
  return CATEGORY_META[category]?.label ?? category;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatInr(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Not stated";
  return `₹${value.toLocaleString("en-IN")}`;
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "Not specified";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "Not specified";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${formatDate(iso)} · ${date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}

export function countdown(days?: number | null): string {
  if (days === null || days === undefined) return "No deadline";
  if (days < 0) return "Closed";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / 86_400_000);
}
