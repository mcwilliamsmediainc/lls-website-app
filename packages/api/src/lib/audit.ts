/**
 * Audit logging helper (spec Table 32).
 * Every state-changing route should call writeAudit so the lls_audit_log table
 * captures who did what, with before/after snapshots where relevant.
 */

import { db, llsAuditLog, type NewAuditLogEntry, type TeamRole } from "./db.js";

export interface AuditInput {
  actorId: number | null;
  actorRole: TeamRole | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  const row: NewAuditLogEntry = {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId == null ? null : String(input.entityId),
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };
  try {
    await db.insert(llsAuditLog).values(row);
  } catch (err) {
    // Never let an audit write failure break the primary operation; surface it loudly.
    console.error("[audit] failed to write entry:", input.action, err);
  }
}
