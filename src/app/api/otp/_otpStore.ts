// OTP audit log + rate-limiting — backed entirely by the database
// (Supabase/Postgres). No in-memory fallback: serverless invocations don't
// share memory, so state must live in the DB to be correct on Vercel.
//
// OTP generation/verification itself is handled by Firebase Phone Auth
// (client-side) — see src/lib/services/firebaseOtp.ts — so this file no longer
// stores OTP codes. It keeps the audit log and the IP rate limiter used by the
// submit/contact routes.

import { db } from '@/lib/db';

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

async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateResult> {
  const now = Date.now();
  const existing = await db.rateLimit.findUnique({ where: { key } });

  // No record yet, or the previous window has fully elapsed → start fresh.
  if (!existing || now - existing.windowStart.getTime() > windowMs) {
    await db.rateLimit.upsert({
      where: { key },
      update: { count: 1, windowStart: new Date(now) },
      create: { key, count: 1, windowStart: new Date(now) },
    });
    return { allowed: true };
  }

  if (existing.count >= maxRequests) {
    const retryAfter = Math.ceil(
      (existing.windowStart.getTime() + windowMs - now) / 1000
    );
    return { allowed: false, retryAfter };
  }

  await db.rateLimit.update({
    where: { key },
    data: { count: existing.count + 1 },
  });
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
