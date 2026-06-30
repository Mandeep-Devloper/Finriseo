import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import {
  getAdminSession,
  adminSessionCookieOptions,
  ADMIN_SESSION_COOKIE,
} from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';

// Ends the admin session: revokes the Firebase refresh tokens (so the session
// cookie can't be re-validated even if it leaked) and clears the httpOnly admin
// cookie. Idempotent — calling it without a session still 200s and clears any
// stray cookie.
export async function POST() {
  try {
    const admin = await getAdminSession();
    if (admin) {
      await getAdminAuth().revokeRefreshTokens(admin.firebaseUid);
      void recordAdminAudit({
        actorAdminId: admin.id,
        action: 'logout',
        targetType: 'admin_user',
        targetId: admin.id,
      });
    }
  } catch (err) {
    // Don't fail logout on a revoke hiccup — clearing the cookie below already
    // ends this browser's session.
    console.warn('[admin-logout] revokeRefreshTokens failed (non-fatal)', {
      code: (err as { code?: string })?.code,
    });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_SESSION_COOKIE, '', { ...adminSessionCookieOptions(), maxAge: 0 });
  return res;
}
