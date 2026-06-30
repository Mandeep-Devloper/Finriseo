// Single entry point for the append-only application audit trail. Records who
// (Firebase uid) did what to which application, and the resulting lender
// routing on submit. Deliberately stores no PII (no phone/PAN) — the actor is
// referenced by uid only.
//
// Best-effort: a failed audit write must never break the user-facing flow, so
// errors are swallowed (same policy as logOtp). This also means it no-ops
// safely until the AuditLog table migration has been applied.
import { db } from '@/lib/db';

type AuditAction = 'started' | 'updated' | 'submitted';

export async function recordAudit(entry: {
  referenceId: string;
  actorUid?: string;
  action: AuditAction;
  lender?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        referenceId: entry.referenceId,
        actorUid: entry.actorUid ?? null,
        action: entry.action,
        lender: entry.lender ?? null,
      },
    });
  } catch (err) {
    return warnAuditFailed(err, entry.action, entry.referenceId);
  }
}

// Admin actions an admin can take. Kept broad-but-typed so the audit viewer
// (Phase 5) can filter by a known, PII-free vocabulary.
export type AdminAuditAction =
  | 'login'
  | 'logout'
  | 'view_detail'
  | 'status_change'
  | 'assign'
  | 'note_add'
  | 'export'
  | 'disbursement_record'
  | 'lender_create'
  | 'lender_update'
  | 'lender_delete'
  | 'user_invite'
  | 'user_update'
  | 'user_deactivate'
  | 'contact_resolve'
  | 'settings_update';

export type AdminAuditTargetType = 'application' | 'lender' | 'admin_user' | 'contact' | 'setting';

/**
 * Record an ADMIN action. Records the admin actor by id (FK → AdminUser) plus the
 * target it acted on; stays PII-free (no borrower phone/PAN — the application is
 * referenced by referenceId only). Best-effort, like recordAudit: a failed audit
 * write must never break an admin action.
 */
export async function recordAdminAudit(entry: {
  actorAdminId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  /** Application referenceId, or the target's id (e.g. lender id) as a string. */
  targetId: string;
  lender?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        referenceId: entry.targetId,
        actorAdminId: entry.actorAdminId,
        targetType: entry.targetType,
        action: entry.action,
        lender: entry.lender ?? null,
      },
    });
  } catch (err) {
    return warnAuditFailed(err, entry.action, entry.targetId);
  }
}

// Shared best-effort failure handler: auditing must never break the main flow,
// so we swallow the error — but log a warning so a missing table or failed write
// is *visible* (a silent no-op previously hid the un-migrated AuditLog table).
// The entry carries no PII (actor + referenceId + action only), so it is safe to
// surface; we still log only the error code/message, not request data.
function warnAuditFailed(err: unknown, action: string, referenceId: string): void {
  console.warn('[audit] write failed (non-fatal)', {
    action,
    referenceId,
    code: (err as { code?: string })?.code,
    message: (err as { message?: string })?.message,
  });
}
