import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The rate limiter is one atomic INSERT…ON CONFLICT upsert; here we mock the DB
// and test the DECISION logic (allow/block + retryAfter) and the dual-check
// short-circuit on top of it.
vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn(),
    rateLimit: { deleteMany: vi.fn().mockResolvedValue({}) },
    otpLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

import { db } from '@/lib/db';
import {
  checkIpRateLimit,
  checkPhoneRateLimit,
  checkDualRateLimit,
  maskPhone,
  logOtp,
} from '@/app/api/otp/_otpStore';

const queryRaw = vi.mocked(db.$queryRaw);

beforeEach(() => {
  queryRaw.mockReset();
  // Skip the 2% opportunistic prune deterministically.
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => vi.restoreAllMocks());

describe('rate limiter decision logic', () => {
  it('allows while the count is within the limit', async () => {
    queryRaw.mockResolvedValue([{ count: 3, windowStart: new Date() }]);
    expect(await checkIpRateLimit('1.2.3.4', 5, 60, 'submit')).toEqual({ allowed: true });
  });

  it('allows exactly at the limit', async () => {
    queryRaw.mockResolvedValue([{ count: 5, windowStart: new Date() }]);
    expect((await checkIpRateLimit('1.2.3.4', 5, 60, 'submit')).allowed).toBe(true);
  });

  it('blocks once the count exceeds the limit and returns a bounded retryAfter', async () => {
    const windowStart = new Date(Date.now() - 10_000); // 10s into a 60-min window
    queryRaw.mockResolvedValue([{ count: 6, windowStart }]);
    const r = await checkPhoneRateLimit('9876543210', 5, 60, 'submit');
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60 * 60);
  });
});

describe('checkDualRateLimit', () => {
  it('short-circuits on the IP check without touching the phone bucket', async () => {
    queryRaw.mockResolvedValueOnce([{ count: 99, windowStart: new Date() }]); // IP blocked
    const r = await checkDualRateLimit({ ip: '1.2.3.4', phone: '9876543210', maxRequests: 5, windowMinutes: 60, scope: 'x' });
    expect(r.allowed).toBe(false);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('proceeds to the phone check when the IP passes', async () => {
    queryRaw
      .mockResolvedValueOnce([{ count: 1, windowStart: new Date() }])   // IP ok
      .mockResolvedValueOnce([{ count: 99, windowStart: new Date() }]); // phone blocked
    const r = await checkDualRateLimit({ ip: '1.2.3.4', phone: '9876543210', maxRequests: 5, windowMinutes: 60, scope: 'x' });
    expect(r.allowed).toBe(false);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('allows when both dimensions pass', async () => {
    queryRaw.mockResolvedValue([{ count: 1, windowStart: new Date() }]);
    const r = await checkDualRateLimit({ ip: '1.2.3.4', phone: '9876543210', maxRequests: 5, windowMinutes: 60, scope: 'x' });
    expect(r.allowed).toBe(true);
  });
});

describe('maskPhone', () => {
  it('keeps only the first and last two digits', () => {
    expect(maskPhone('9876543210')).toBe('98****10');
    expect(maskPhone('+919876543210')).toBe('91****10');
  });
  it('fully redacts too-short values', () => {
    expect(maskPhone('12')).toBe('****');
  });
});

describe('logOtp', () => {
  it('never throws even if the DB write fails', async () => {
    vi.mocked(db.otpLog.create).mockRejectedValueOnce(new Error('db down'));
    await expect(logOtp('9876543210', 'failed')).resolves.toBeUndefined();
  });
});
