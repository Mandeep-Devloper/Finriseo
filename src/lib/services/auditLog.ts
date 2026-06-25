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
    // Auditing must never break the main flow, so we still swallow the error —
    // but we log a warning so a missing table or failed write is *visible*
    // (a silent no-op previously hid the un-migrated AuditLog table). The audit
    // entry carries no PII (uid + referenceId + action only), so it is safe to
    // surface here; we still log only the error code/message, not request data.
    console.warn('[audit] write failed (non-fatal)', {
      action: entry.action,
      referenceId: entry.referenceId,
      code: (err as { code?: string })?.code,
      message: (err as { message?: string })?.message,
    });
  }
}
