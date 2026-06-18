import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth } from '@/lib/firebase-admin';
import { logOtp } from '../_otpStore';

// Firebase Phone Auth verifies the OTP on the client. Here we verify the
// resulting Firebase ID token and confirm its phone number matches the mobile
// the user is applying with, so the server can trust the verification.
const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  idToken: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const { mobile, idToken } = result.data;

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch {
      await logOtp(mobile, 'failed');
      return NextResponse.json(
        { success: false, error: 'Could not verify OTP. Request a new one.' },
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
    return NextResponse.json({ success: true, verified: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
