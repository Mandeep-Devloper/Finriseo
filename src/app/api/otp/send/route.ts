import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOtp, checkRateLimit, saveOtpSession, logOtp } from '../_otpStore';

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error.issues[0]?.message ?? 'Invalid input' },
        { status: 400 }
      );
    }

    const { mobile } = result.data;

    const rateCheck = await checkRateLimit(mobile);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Retry in ${rateCheck.retryAfter}s.` },
        { status: 429 }
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await saveOtpSession(mobile, otp, expiresAt);
    await logOtp(mobile, 'sent');

    // TODO: MSG91 integration
    // await msg91.sendOtp(mobile, otp);
    console.log(`[OTP SEND] Mobile: ${mobile} | OTP: ${otp}`);

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your mobile number',
      expiresInSeconds: 600,
      ...(process.env.NODE_ENV === 'development' && { _devOtp: otp }),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
