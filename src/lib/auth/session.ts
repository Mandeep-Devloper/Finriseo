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
