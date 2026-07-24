import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    trustedSession: { deleteMany: vi.fn() },
    application: { deleteMany: vi.fn() },
    otpLog: { deleteMany: vi.fn() },
  },
}));

import { db } from '@/lib/db';
import {
  purgeRetention,
  STALE_DRAFT_DAYS,
  OTP_LOG_DAYS,
  REVOKED_SESSION_GRACE_DAYS,
} from './retention';

const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.trustedSession.deleteMany).mockResolvedValue({ count: 3 } as never);
  vi.mocked(db.application.deleteMany).mockResolvedValue({ count: 2 } as never);
  vi.mocked(db.otpLog.deleteMany).mockResolvedValue({ count: 5 } as never);
});

describe('purgeRetention', () => {
  it('aggregates deletion counts from each table', async () => {
    const res = await purgeRetention(new Date('2026-07-24T00:00:00Z'));
    expect(res).toEqual({ expiredTrustedSessions: 3, staleDrafts: 2, oldOtpLogs: 5 });
  });

  it('deletes expired OR long-revoked trusted sessions', async () => {
    const now = new Date('2026-07-24T00:00:00Z');
    await purgeRetention(now);
    const where = vi.mocked(db.trustedSession.deleteMany).mock.calls[0][0]!.where;
    expect(where).toEqual({
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - REVOKED_SESSION_GRACE_DAYS * DAY_MS) } },
      ],
    });
  });

  it('deletes only stale DRAFT applications past the cutoff', async () => {
    const now = new Date('2026-07-24T00:00:00Z');
    await purgeRetention(now);
    const where = vi.mocked(db.application.deleteMany).mock.calls[0][0]!.where;
    expect(where).toEqual({
      status: 'draft',
      lastActivityAt: { lt: new Date(now.getTime() - STALE_DRAFT_DAYS * DAY_MS) },
    });
  });

  it('prunes OTP logs past the cutoff', async () => {
    const now = new Date('2026-07-24T00:00:00Z');
    await purgeRetention(now);
    const where = vi.mocked(db.otpLog.deleteMany).mock.calls[0][0]!.where;
    expect(where).toEqual({ createdAt: { lt: new Date(now.getTime() - OTP_LOG_DAYS * DAY_MS) } });
  });
});
