import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAuth } from '@/lib/firebase-admin';

// ── DEV-ONLY OTP bypass ──────────────────────────────────────────────
// Firebase now blocks Phone Auth SMS entirely on the free Spark plan
// (auth/billing-not-enabled — even for console "test numbers" on new
// projects). This route lets local dev skip ONLY the SMS step: it mints a
// Firebase *custom token* for the given mobile (custom tokens are free and
// involve no SMS). The client signs in with it for real, so the resulting
// ID token carries the phone_number claim and /api/otp/verify, the session
// cookie, and all phone-ownership checks run production-identical.
//
// Double-gated so this is dead in production:
//   1. NODE_ENV must not be 'production' (Vercel/`next start` always is).
//   2. OTP_DEV_BYPASS=1 must be explicitly set in .env.
// Remove/unset OTP_DEV_BYPASS after upgrading Firebase to Blaze.

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
});

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' || process.env.OTP_DEV_BYPASS !== '1') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const phone = `+91${result.data.mobile}`;
    const auth = getAdminAuth();

    // Reuse the Auth user for this phone if it exists, else create it —
    // the phone_number on the user record is what lands in the ID token.
    let uid: string;
    try {
      uid = (await auth.getUserByPhoneNumber(phone)).uid;
    } catch {
      uid = (await auth.createUser({ phoneNumber: phone })).uid;
    }

    const customToken = await auth.createCustomToken(uid);
    console.info('[otp-dev-bypass] Minted custom token for', phone.replace(/\d(?=\d{4})/g, '*'));
    return NextResponse.json({ success: true, customToken });
  } catch (err) {
    console.error('[otp-dev-bypass] FAILED', {
      code: (err as { code?: string })?.code,
      message: (err as { message?: string })?.message,
    });
    return NextResponse.json({ success: false, error: 'Dev bypass failed' }, { status: 500 });
  }
}
