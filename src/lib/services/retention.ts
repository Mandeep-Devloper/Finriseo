import 'server-only';
import { db } from '@/lib/db';

// Data-retention purge. Enforces the policy documented at the top of
// prisma/schema.prisma: stale drafts and operational logs are not kept forever,
// and trusted sessions don't linger past their usefulness. Idempotent and safe
// to run repeatedly (each pass only deletes rows past their cutoff).

const DAY_MS = 24 * 60 * 60 * 1000;

/** Draft applications with no activity for this long are abandoned leads → purge. */
export const STALE_DRAFT_DAYS = 90;
/** OtpLog is operational only; nothing needs it past this. */
export const OTP_LOG_DAYS = 90;
/** Keep revoked trusted sessions briefly for audit, then remove. */
export const REVOKED_SESSION_GRACE_DAYS = 7;

export interface RetentionResult {
  expiredTrustedSessions: number;
  staleDrafts: number;
  oldOtpLogs: number;
}

/**
 * Delete data past its retention window. `now` is injectable for testing.
 * Order matters only for efficiency: purge sessions first (cheap), then stale
 * drafts (their remaining sessions cascade-delete), then OTP logs.
 */
export async function purgeRetention(now: Date = new Date()): Promise<RetentionResult> {
  const staleDraftCutoff = new Date(now.getTime() - STALE_DRAFT_DAYS * DAY_MS);
  const otpCutoff = new Date(now.getTime() - OTP_LOG_DAYS * DAY_MS);
  const revokedCutoff = new Date(now.getTime() - REVOKED_SESSION_GRACE_DAYS * DAY_MS);

  const sessions = await db.trustedSession.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: revokedCutoff } },
      ],
    },
  });

  // Cascade (schema onDelete: Cascade) removes each draft's remaining sessions/notes.
  const drafts = await db.application.deleteMany({
    where: { status: 'draft', lastActivityAt: { lt: staleDraftCutoff } },
  });

  const otp = await db.otpLog.deleteMany({ where: { createdAt: { lt: otpCutoff } } });

  return {
    expiredTrustedSessions: sessions.count,
    staleDrafts: drafts.count,
    oldOtpLogs: otp.count,
  };
}
