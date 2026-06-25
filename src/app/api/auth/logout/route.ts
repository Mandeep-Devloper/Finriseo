
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getSession, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session';

// Ends the server session: revokes the user's Firebase refresh tokens (so the
// session cookie can't be re-validated even if it leaked) and clears the
// httpOnly cookie. Idempotent — calling it without a session still 200s and
// clears any stray cookie.
export async function POST() {
  // Best-effort revoke. Read the session first so we know whose tokens to
  // revoke; a missing/expired session just means there's nothing to revoke.
  try {
    const session = await getSession();
    if (session) {
      await getAdminAuth().revokeRefreshTokens(session.uid);
    }
  } catch (err) {
    // Don't fail logout on a revoke hiccup — clearing the cookie below already
    // ends this browser's session.
    console.warn('[logout] revokeRefreshTokens failed (non-fatal)', {
      code: (err as { code?: string })?.code,
    });
  }

  const res = NextResponse.json({ success: true });
  // Expire the cookie: same attributes as when set, maxAge 0.
  res.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
  return res;
}
