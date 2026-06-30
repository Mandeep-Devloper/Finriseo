import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import {
  createAdminSessionCookie,
  adminSessionCookieOptions,
  ADMIN_SESSION_COOKIE,
} from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { checkIpRateLimit, checkPhoneRateLimit } from '@/app/api/otp/_otpStore';
import { adminLoginSchema as schema } from '@/lib/validations';

// Admin login. The browser authenticates with Firebase Email/Password (client
// SDK) and posts the resulting ID token here. This route is the authorization
// boundary: it verifies the token, confirms the user maps to an ACTIVE AdminUser,
// and only then mints the admin session cookie. It is intentionally SEPARATE
// from the borrower OTP flow (different cookie, different provider).
//
// Generic 401 on every failure path (bad token / not an admin / deactivated) so
// the endpoint never reveals whether an email is an admin account.

function tooMany(retryAfter?: number) {
  return NextResponse.json(
    { success: false, error: `Too many attempts. Try again in ${Math.ceil((retryAfter ?? 900) / 60)} minutes.` },
    { status: 429 }
  );
}

function unauthorized() {
  return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
}

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown';

    // IP rate-limit BEFORE the (more expensive) token verification — primary
    // brute-force / abuse control on this endpoint. 10 attempts / 15 min.
    const ipRate = await checkIpRateLimit(ip, 10, 15, 'admin-login');
    if (!ipRate.allowed) return tooMany(ipRate.retryAfter);

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const { idToken } = result.data;

    // Verify the Firebase ID token (checkRevoked = true).
    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken, true);
    } catch (err) {
      console.error('[admin-login] verifyIdToken failed', {
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
      });
      return unauthorized();
    }

    // Must be an Email/Password sign-in — a borrower phone-auth token must never
    // be accepted here (defence-in-depth on top of the AdminUser lookup below).
    if (decoded.firebase?.sign_in_provider !== 'password') {
      return unauthorized();
    }

    // Freshness: require a recent sign-in to limit replay of an old token.
    const MAX_AUTH_AGE_SECONDS = 10 * 60;
    if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      return NextResponse.json(
        { success: false, error: 'Session expired. Please sign in again.' },
        { status: 401 }
      );
    }

    const email = decoded.email?.toLowerCase();
    if (!email) return unauthorized();

    // Per-account attempt cap (defence-in-depth alongside the IP limit). The
    // shared keyed limiter is reused; the "phone:" key namespace is internal.
    const emailRate = await checkPhoneRateLimit(email, 10, 15, 'admin-login');
    if (!emailRate.allowed) return tooMany(emailRate.retryAfter);

    // Authorization decision: the DB AdminUser row (role + active) is the source
    // of truth. uid is the real key; a valid Firebase user with no active
    // AdminUser is not an admin.
    const admin = await db.adminUser.findUnique({ where: { firebaseUid: decoded.uid } });
    if (!admin || !admin.active) {
      return unauthorized();
    }

    // Mint the admin session cookie from the fresh ID token.
    const res = NextResponse.json({ success: true, role: admin.role });
    try {
      const sessionCookie = await createAdminSessionCookie(idToken);
      res.cookies.set(ADMIN_SESSION_COOKIE, sessionCookie, adminSessionCookieOptions());
    } catch (err) {
      // Token just outside the 5-min cookie-mint window — ask the client to retry.
      console.error('[admin-login] createSessionCookie failed', {
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
      });
      return NextResponse.json(
        { success: false, error: 'Could not establish session. Please sign in again.' },
        { status: 401 }
      );
    }

    // Record the login (last-login + PII-free audit). Best-effort — never block
    // the response on these writes.
    void db.adminUser
      .update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })
      .catch(() => {});
    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'login',
      targetType: 'admin_user',
      targetId: admin.id,
    });

    return res;
  } catch (err) {
    // Surface the real cause (e.g. a stale in-memory Prisma client after a
    // migration → restart `next dev`; or an unexpected DB/Firebase failure)
    // instead of a silent 500. PII-free: logs error code/message/name only.
    console.error('[admin-login] unhandled error', {
      name: (err as { name?: string })?.name,
      code: (err as { code?: string })?.code,
      message: (err as { message?: string })?.message,
    });
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
