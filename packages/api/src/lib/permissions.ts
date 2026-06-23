/**
 * Role-based permission matrix — server-side enforcement.
 *
 * Source of truth: spec v5.3 Table 28 (Role × Feature matrix), reconciled with
 * the kickoff prompt Section 10 "Key rules".
 *
 * Build-time override: `push_to_live` is restricted to `matt` for THIS build.
 * Table 28 grants it to Matt and Tyler; the prompt states Tyler resumes as
 * primary once infrastructure is stable. Flip PUSH_TO_LIVE_BUILD_OVERRIDE to
 * false to restore the full Table 28 behavior.
 *
 * "A" cells in Table 28 ("approve only") are modeled as the capability being
 * granted — the route layer decides whether the action is an approve vs a full
 * edit where that distinction matters.
 */

import type { TeamRole } from "@lls/db";

export type Permission =
  | "add_edit_client"
  | "delete_client"
  | "queue_job"
  | "push_to_live"
  | "edit_client_facts"
  | "approve_content"
  | "edit_schema"
  | "send_wireframe_review_link"
  | "lock_unlock_revision_rounds"
  | "view_all_clients"
  | "edit_team_members"
  | "change_kb_documents"
  | "bypass_style_gate"
  | "rollback_deployment"
  | "view_activity_logs"
  | "access_settings"
  | "queue_command";

const ALL_ROLES: TeamRole[] = [
  "matt",
  "tiffany",
  "elise",
  "chloe",
  "penn",
  "rachelle",
  "clarence",
  "tyler",
];

const PUSH_TO_LIVE_BUILD_OVERRIDE = true;

/**
 * ⚠ GLOBAL OVERRIDE — grants every role EVERY permission.
 * Enabled 2026-06-23 by explicit owner request. When true this BYPASSES the
 * entire role × feature matrix below, including push_to_live (live WordPress),
 * delete_client, bypass_style_gate, rollback_deployment, and edit_team_members,
 * and also grants full audit-log read to everyone.
 * The MATRIX below is preserved intact: set this back to false to restore the
 * spec v5.3 Table 28 behavior exactly.
 */
const ALLOW_ALL_PERMISSIONS = true;

const MATRIX: Record<Permission, TeamRole[]> = {
  add_edit_client: ["matt", "tiffany", "elise", "penn", "tyler"],
  delete_client: ["matt", "tyler"],
  queue_job: ALL_ROLES,
  push_to_live: PUSH_TO_LIVE_BUILD_OVERRIDE ? ["matt"] : ["matt", "tyler"],
  edit_client_facts: ["matt", "tiffany", "elise", "tyler"],
  approve_content: ["matt", "tiffany", "penn", "rachelle", "clarence"],
  edit_schema: ["matt", "rachelle", "tyler"],
  send_wireframe_review_link: ["matt", "tiffany", "elise", "chloe", "tyler"],
  lock_unlock_revision_rounds: ["matt", "tiffany", "tyler"],
  view_all_clients: [...ALL_ROLES, "lindsay"],
  edit_team_members: ["matt", "tyler"],
  change_kb_documents: ["matt", "tiffany", "rachelle", "tyler"],
  bypass_style_gate: ["matt", "tyler"],
  rollback_deployment: ["matt", "tyler"],
  view_activity_logs: [...ALL_ROLES, "lindsay"],
  access_settings: ["matt", "tyler"],
  // Command Center: only matt and tyler may queue instructions for the server operator.
  queue_command: ["matt", "tyler"],
};

/** True if the role is allowed to perform the given action. */
export function can(role: TeamRole, permission: Permission): boolean {
  if (ALLOW_ALL_PERMISSIONS) return true;
  return MATRIX[permission].includes(role);
}

/** Roles that can read ALL audit logs. Others read only their own (spec Table 32). */
export function canReadAllAuditLogs(role: TeamRole): boolean {
  if (ALLOW_ALL_PERMISSIONS) return true;
  return role === "matt" || role === "tyler";
}

/** Returns the full permission map for a role — handy for the web client UI gating. */
export function permissionsFor(role: TeamRole): Record<Permission, boolean> {
  const out = {} as Record<Permission, boolean>;
  for (const key of Object.keys(MATRIX) as Permission[]) {
    out[key] = can(role, key);
  }
  return out;
}
