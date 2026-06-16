import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getOtpSession, incrementOtpAttempts, deleteOtpSession, logOtp } from '../_otpStore';

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  otp: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const { mobile, otp } = result.data;
    const stored = await getOtpSession(mobile);

    if (!stored) {
      return NextResponse.json(
        { success: false, error: 'OTP not found. Request a new one.' },
        { status: 400 }
      );
    }
    if (Date.now() > stored.expiresAt.getTime()) {
      await deleteOtpSession(mobile);
      await logOtp(mobile, 'expired');
      return NextResponse.json(
        { success: false, error: 'OTP expired. Request a new one.' },
        { status: 400 }
      );
    }
    if (stored.attempts >= 5) {
      await deleteOtpSession(mobile);
      await logOtp(mobile, 'failed');
      return NextResponse.json(
        { success: false, error: 'Too many wrong attempts. Request a new OTP.' },
        { status: 429 }
      );
    }
    if (stored.otp !== otp) {
      await incrementOtpAttempts(mobile, stored.attempts);
      return NextResponse.json(
        { success: false, error: `Wrong OTP. ${5 - stored.attempts - 1} attempts left.` },
        { status: 400 }
      );
    }

    await deleteOtpSession(mobile);
    await logOtp(mobile, 'verified');
    return NextResponse.json({ success: true, verified: true });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
