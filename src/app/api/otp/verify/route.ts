import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { createSessionCookie, sessionCookieOptions, SESSION_COOKIE } from '@/lib/auth/session';
import { otpVerifySchema as schema } from '@/lib/validations';
import { logOtp, maskPhone, checkPhoneRateLimit } from '../_otpStore';

// Firebase Phone Auth verifies the OTP on the client. Here we verify the
// resulting Firebase ID token and confirm its phone number matches the mobile
// the user is applying with, so the server can trust the verification.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const { mobile, idToken } = result.data;

    // Cap verification attempts per phone (defence-in-depth on top of Firebase's
    // own client-side OTP throttling): 10 attempts per 10 minutes.
    const rate = await checkPhoneRateLimit(mobile, 10, 10, 'otp-verify');
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Diagnostic: confirm the server-side (firebase-admin) credentials are wired.
    // Missing any of these means verifyIdToken will always throw.
    const adminEnvMissing = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'FIREBASE_PRIVATE_KEY',
    ].filter((k) => !process.env[k]);
    if (adminEnvMissing.length) {
      console.error(
        '[otp-verify] Missing admin env:', adminEnvMissing,
        '→ set these server env vars (locally AND in Vercel) from the Firebase service-account JSON.'
      );
    }

    let decoded;
    try {
      decoded = await getAdminAuth().verifyIdToken(idToken);
    } catch (err) {
      console.error(
        '[otp-verify] verifyIdToken FAILED',
        { code: (err as { code?: string })?.code, message: (err as { message?: string })?.message },
        '→ token invalid/expired, or admin creds belong to a DIFFERENT Firebase project than the client.'
      );
      await logOtp(mobile, 'failed');
      return NextResponse.json(
        { success: false, error: 'Could not verify OTP. Request a new one.' },
        { status: 401 }
      );
    }

    console.info('[otp-verify] Token OK', {
      tokenPhone: maskPhone(decoded.phone_number ?? ''),
      expectedPhone: maskPhone(mobile),
      authTimeAgeSec: Math.round(Date.now() / 1000 - decoded.auth_time),
    });

    // Reject stale tokens: a Firebase ID token stays valid ~1h, so without a
    // freshness check an old token from a prior sign-in could be replayed to
    // claim verification without a fresh OTP. Require the sign-in (auth_time,
    // in seconds) to be recent.
    const MAX_AUTH_AGE_SECONDS = 10 * 60;
    if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      await logOtp(mobile, 'expired');
      return NextResponse.json(
        { success: false, error: 'OTP session expired. Request a new one.' },
        { status: 401 }
      );
    }

    if (decoded.phone_number !== `+91${mobile}`) {
      await logOtp(mobile, 'failed');
      return NextResponse.json(
        { success: false, error: 'Mobile number does not match the verified number.' },
        { status: 400 }
      );
    }

    // Fire-and-forget the audit log so the response isn't gated on a DB write
    // (the verification itself is already done). logOtp swallows its own errors.
    void logOtp(mobile, 'verified');

    // Establish the server session: mint a Firebase session cookie from the
    // (fresh) ID token and set it httpOnly so the client never holds the raw
    // token. This cookie is the real auth gate honored by /api/application/*.
    const res = NextResponse.json({ success: true, verified: true });
    try {
      const sessionCookie = await createSessionCookie(idToken);
      res.cookies.set(SESSION_COOKIE, sessionCookie, sessionCookieOptions());
    } catch (err) {
      // Verification itself already succeeded; if cookie minting fails (e.g.
      // token just outside the 5-min freshness window), don't fail the request —
      // the gated routes will return 401 and the client can re-verify.
      console.error('[otp-verify] session cookie mint failed', {
        code: (err as { code?: string })?.code,
      });
    }
    return res;
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
