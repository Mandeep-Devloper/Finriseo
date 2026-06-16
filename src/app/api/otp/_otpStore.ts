// OTP + rate-limit store — backed entirely by the database (Supabase/Postgres).
// No in-memory fallback: serverless invocations don't share memory, so state
// must live in the DB to be correct on Vercel.

import { db } from '@/lib/db';

// ── OTP sessions ────────────────────────────────────────────────────

export async function saveOtpSession(mobile: string, otp: string, expiresAt: Date) {
  await db.otpSession.upsert({
    where: { mobile },
    update: { otp, expiresAt, attempts: 0 },
    create: { mobile, otp, expiresAt },
  });
}

export async function getOtpSession(mobile: string) {
  return db.otpSession.findUnique({ where: { mobile } });
}

export async function incrementOtpAttempts(mobile: string, current: number) {
  await db.otpSession.update({
    where: { mobile },
    data: { attempts: current + 1 },
  });
}

export async function deleteOtpSession(mobile: string) {
  try {
    await db.otpSession.delete({ where: { mobile } });
  } catch {
    /* already deleted */
  }
}

// ── OTP audit log (was a dead table) ────────────────────────────────

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

// ── OTP generation ──────────────────────────────────────────────────

export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

// Per-mobile OTP send limit: 3 per 10 minutes.
export function checkRateLimit(mobile: string): Promise<RateResult> {
  return rateLimit(`otp:${mobile}`, 3, 10 * 60 * 1000);
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
