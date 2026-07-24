// Server-side session layer (Node runtime only — uses firebase-admin, which
// cannot run in edge middleware). After a successful Firebase Phone Auth OTP,
// /api/otp/verify mints a Firebase *session cookie* from the ID token; every
// protected API route then calls requireSession() to cryptographically verify
// that cookie before doing any work. This is the real authorization gate — the
// client-side Zustand funnel is UX only.
import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import { getTrustedSession } from './trustedSession';
import type { HeaderGetter } from '@/lib/http/ip';
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/auth/constants';

export { SESSION_COOKIE, SESSION_TTL_MS };

/** Thrown by requireSession() when there is no valid session. */
export class SessionError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'SessionError';
  }
}

export interface SessionUser {
  uid: string;
  /** Verified mobile, normalized to the 10-digit form stored on Application. */
  phone: string;
}

/**
 * Exchange a fresh Firebase ID token for a session cookie value. The ID token
 * must be recent (Firebase requires its auth instant to be within ~5 min), which
 * the OTP verify route already enforces.
 */
export function createSessionCookie(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, { expiresIn: SESSION_TTL_MS });
}

/** Cookie attributes for the session cookie. httpOnly + Secure(prod) + Lax. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

/**
 * Read and cryptographically verify the session cookie (checking revocation).
 * Returns the session user, or null if there is no valid session.
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    const phone = (decoded.phone_number ?? '').replace(/^\+91/, '');
    if (!phone) return null;
    return { uid: decoded.uid, phone };
  } catch {
    return null;
  }
}

/** Like getSession() but throws SessionError when unauthenticated. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new SessionError();
  return session;
}

/** Standard 401 response for unauthenticated API requests. */
export function unauthorized() {
  return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
}

export interface DraftAccess {
  /** Verified owner mobile (10-digit). */
  mobile: string;
  /** Firebase uid when authorized via the Firebase session. */
  uid?: string;
  via: 'firebase' | 'trusted';
}

/**
 * Authorize a DRAFT-scoped operation on the application identified by
 * `referenceId`. Accepts EITHER a valid Firebase session whose phone owns the
 * row, OR a valid trusted-browser session whose applicationId maps to the row and
 * whose mobile matches. Only rows with status='draft' are eligible — this is the
 * hard boundary that keeps the 7-day trusted cookie away from submitted records.
 * Throws SessionError otherwise.
 */
export async function requireDraftAccess(
  headers: HeaderGetter,
  referenceId: string
): Promise<DraftAccess> {
  const row = await db.application.findUnique({
    where: { referenceId },
    select: { id: true, mobile: true, status: true },
  });
  if (!row || row.status !== 'draft') throw new SessionError();

  // Path 1: Firebase session (strong, 1h).
  const fb = await getSession();
  if (fb && fb.phone === row.mobile) {
    return { mobile: row.mobile, uid: fb.uid, via: 'firebase' };
  }

  // Path 2: trusted-browser session (7d, draft-scoped).
  const trusted = await getTrustedSession(headers);
  if (trusted && trusted.mobile === row.mobile && trusted.applicationId === row.id) {
    return { mobile: row.mobile, via: 'trusted' };
  }

  throw new SessionError();
}
