/** Typed fetch helpers for the LLS API. Cookies carry the session. */

const BASE = "";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = `${res.status}`;
    try {
      const data = await res.json();
      message = data.error ?? message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const api = {
  get: <T>(p: string) => request<T>("GET", p),
  post: <T>(p: string, body?: unknown) => request<T>("POST", p, body),
  patch: <T>(p: string, body?: unknown) => request<T>("PATCH", p, body),
  del: <T>(p: string) => request<T>("DELETE", p),
};

/* ---- shared types (mirrors API responses) ---- */

export type Permission =
  | "add_edit_client" | "delete_client" | "queue_job" | "push_to_live"
  | "edit_client_facts" | "approve_content" | "edit_schema" | "send_wireframe_review_link"
  | "lock_unlock_revision_rounds" | "view_all_clients" | "edit_team_members"
  | "change_kb_documents" | "bypass_style_gate" | "rollback_deployment"
  | "view_activity_logs" | "access_settings";

export interface User {
  id: number;
  name: string;
  role: string;
  username: string;
}

export interface AuthResponse {
  user: User;
  permissions: Record<Permission, boolean>;
}

export type Stage = "intake" | "content" | "review" | "live";

export interface Client {
  id: number;
  slug: string;
  businessName: string;
  siteUrl: string | null;
  siteType: string;
  stage: Stage;
  stagingUrl: string | null;
  liveUrl: string | null;
  rankMapVerdict: string | null;
  phaseUnlocked: number;
  createdAt: string;
}

export interface Job {
  id: number;
  clientId: number;
  taskType: string;
  status: string;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  log: string;
  outputFiles: string[];
  errorMessage: string | null;
}

export interface ChecklistItem {
  id: number;
  stage: Stage;
  itemName: string;
  status: string;
  completedAt: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface ContentPage {
  id: number;
  pageType: string;
  slug: string;
  title: string | null;
  status: string;
  wordCount: number;
  gateStatus: string;
  gateFailureReason: string | null;
  verifyFlagsCount: number;
  verifyFlagsResolved: number;
  schemaGenerated: boolean;
}

export interface BrainInjection {
  status: string;
  onboardingUrl: string;
  submittedAt: string | null;
  answers: Record<string, string | null> | null;
}

export interface TeamMember {
  id: number;
  name: string;
  role: string;
  username: string;
  email: string;
  active: boolean;
  hasTotp: boolean;
}

export const TEAM_ROLES = [
  "matt", "tiffany", "elise", "chloe", "penn", "rachelle", "clarence", "tyler", "lindsay",
] as const;

export interface WorkerHealth {
  workerId: string;
  status: string;
  jobsProcessed: number;
  secondsSinceLastSeen: number;
  stale: boolean;
}
