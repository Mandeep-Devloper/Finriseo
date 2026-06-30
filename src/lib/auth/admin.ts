// Server-side ADMIN authorization gate (Node runtime only — uses firebase-admin,
// which cannot run in edge middleware). This is the real security boundary for
// the admin panel: every /admin page and /api/admin/* route MUST call
// requireAdmin() before doing any work. The middleware cookie-presence check is
// a UX redirect only, NOT authorization.
//
// Separation from the borrower layer is structural:
//   - Admins authenticate with Firebase Email/Password → ADMIN_SESSION_COOKIE.
//   - Borrowers authenticate with Phone OTP → SESSION_COOKIE (with a phone claim).
//   - The DB AdminUser row (role + active) is the source of truth for authz;
//     a valid Firebase session that has no matching active AdminUser is rejected.
// A borrower phone session therefore can never reach an admin route: it neither
// presents the admin cookie nor maps to an AdminUser.
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';
import { getAdminAuth } from '@/lib/firebase-admin';
import { db } from '@/lib/db';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
} from '@/lib/auth/constants';

export { ADMIN_SESSION_COOKIE, ADMIN_SESSION_TTL_MS };

/** Thrown when there is no valid admin session at all. → 401 */
export class AdminAuthError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'AdminAuthError';
  }
}

/** Thrown when a valid admin lacks the required role for an action. → 403 */
export class AdminForbiddenError extends Error {
  constructor() {
    super('Forbidden');
    this.name = 'AdminForbiddenError';
  }
}

export interface AdminActor {
  id: string;
  firebaseUid: string;
  email: string;
  name: string;
  role: Role;
}

/** Mint an admin session cookie from a fresh Firebase Email/Password ID token. */
export function createAdminSessionCookie(idToken: string): Promise<string> {
  return getAdminAuth().createSessionCookie(idToken, {
    expiresIn: ADMIN_SESSION_TTL_MS,
  });
}

/** Cookie attributes for the admin session cookie. httpOnly + Secure(prod) + Strict. */
export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Strict (vs the borrower flow's Lax): the admin panel is never reached via
    // an external link/redirect, so Strict adds CSRF defence-in-depth for free.
    sameSite: 'strict' as const,
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  };
}

/**
 * Read + cryptographically verify the admin session cookie (checking revocation),
 * then confirm the Firebase user maps to an ACTIVE AdminUser. Returns the admin
 * actor, or null if there is no valid+active admin session.
 *
 * The DB lookup is the authorization decision — role/active live there, never in
 * the token — so deactivating an admin takes effect on their next request.
 */
// Wrapped in React cache() so the layout's gate and the page's role check share
// ONE verification (cookie verify + DB lookup) per request, instead of hitting
// Firebase + the DB twice on every admin navigation.
export const getAdminSession = cache(async (): Promise<AdminActor | null> => {
  const cookie = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!cookie) return null;

  let firebaseUid: string;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, true);
    firebaseUid = decoded.uid;
  } catch {
    return null;
  }

  const admin = await db.adminUser.findUnique({ where: { firebaseUid } });
  if (!admin || !admin.active) return null;

  return {
    id: admin.id,
    firebaseUid: admin.firebaseUid,
    email: admin.email,
    name: admin.name,
    role: admin.role,
  };
});

/**
 * The authorization gate. Returns the admin actor when authenticated, throwing:
 *   - AdminAuthError (→ 401) when there is no valid active admin session;
 *   - AdminForbiddenError (→ 403) when allowedRoles is given and the admin's
 *     role is not in it.
 * Pass no allowedRoles to allow any active admin (any role).
 */
export async function requireAdmin(allowedRoles?: Role[]): Promise<AdminActor> {
  const admin = await getAdminSession();
  if (!admin) throw new AdminAuthError();
  if (allowedRoles && allowedRoles.length && !allowedRoles.includes(admin.role)) {
    throw new AdminForbiddenError();
  }
  return admin;
}

/** Standard JSON error response for an admin auth/role failure. */
export function adminAuthErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof AdminForbiddenError) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }
  if (err instanceof AdminAuthError) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
