// OTP audit log + rate-limiting — backed entirely by the database
// (Supabase/Postgres). No in-memory fallback: serverless invocations don't
// share memory, so state must live in the DB to be correct on Vercel.
//
// OTP generation/verification itself is handled by Firebase Phone Auth
// (client-side) — see src/lib/services/firebaseOtp.ts — so this file no longer
// stores OTP codes. It keeps the audit log and the IP rate limiter used by the
// submit/contact routes.

import { db } from '@/lib/db';

// ── PII masking ─────────────────────────────────────────────────────
// Never log raw phone numbers (or other PII). Keep enough to correlate
// support cases without storing identifiable data in logs.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
}

// ── OTP audit log ───────────────────────────────────────────────────

export async function logOtp(
  mobile: string,
  status: 'sent' | 'verified' | 'expired' | 'failed'
) {
  try {
    await db.otpLog.create({ data: { mobile, status } });
  } catch {
    /* logging must never break the main flow */
  }
}

// ── Rate limiting (DB-backed, serverless-safe) ──────────────────────

type RateResult = { allowed: boolean; retryAfter?: number };

// Opportunistic cleanup so the RateLimit table doesn't grow unbounded — no cron
// required. Every window we use is <= 60 min, so rows untouched for 24h are
// definitely stale. Runs on ~2% of calls, fire-and-forget: never blocks or fails
// a request.
function maybePruneRateLimits(): void {
  if (Math.random() > 0.02) return;
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  void db.rateLimit.deleteMany({ where: { windowStart: { lt: cutoff } } }).catch(() => {});
}

async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateResult> {
  maybePruneRateLimits();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);

  // Fixed-window counter as ONE atomic statement (insert-or-increment with a
  // window reset), so two concurrent requests can never both read the same
  // count and slip past the limit — the read-check-write version had exactly
  // that race. The id is only used on the insert arm; conflicts key on `key`.
  const [row] = await db.$queryRaw<{ count: number; windowStart: Date }[]>`
    INSERT INTO "RateLimit" ("id", "key", "count", "windowStart", "updatedAt")
    VALUES (${crypto.randomUUID()}, ${key}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count"       = CASE WHEN "RateLimit"."windowStart" <= ${cutoff} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "windowStart" = CASE WHEN "RateLimit"."windowStart" <= ${cutoff} THEN ${now} ELSE "RateLimit"."windowStart" END,
      "updatedAt"   = ${now}
    RETURNING "count", "windowStart"
  `;

  if (row.count > maxRequests) {
    const retryAfter = Math.ceil(
      (row.windowStart.getTime() + windowMs - now.getTime()) / 1000
    );
    return { allowed: false, retryAfter };
  }
  return { allowed: true };
}

// Per-IP limit for submit/contact routes. `scope` keeps each route's bucket
// separate so a submit and a contact from the same IP don't share a counter.
export function checkIpRateLimit(
  ip: string,
  maxRequests = 5,
  windowMinutes = 60,
  scope = 'default'
): Promise<RateResult> {
  return rateLimit(`ip:${scope}:${ip}`, maxRequests, windowMinutes * 60 * 1000);
}

// Per-phone limit, complementing the per-IP one (the brief requires both):
// a single phone shouldn't be able to hammer a route from rotating IPs.
export function checkPhoneRateLimit(
  phone: string,
  maxRequests = 5,
  windowMinutes = 60,
  scope = 'default'
): Promise<RateResult> {
  return rateLimit(`phone:${scope}:${phone}`, maxRequests, windowMinutes * 60 * 1000);
}

// Convenience: enforce per-IP AND per-phone limits for an authenticated route in
// one call. Returns the first check that fails (so the caller can surface its
// retryAfter), or an allowed result when both pass.
export async function checkDualRateLimit(opts: {
  ip: string;
  phone: string;
  maxRequests: number;
  windowMinutes: number;
  scope: string;
}): Promise<RateResult> {
  const ipCheck = await checkIpRateLimit(opts.ip, opts.maxRequests, opts.windowMinutes, opts.scope);
  if (!ipCheck.allowed) return ipCheck;
  return checkPhoneRateLimit(opts.phone, opts.maxRequests, opts.windowMinutes, opts.scope);
}
