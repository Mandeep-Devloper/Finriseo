import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateOtp, checkRateLimit, saveOtpSession, logOtp } from '../_otpStore';
import { isMsg91Configured, sendOtpSms } from '@/lib/msg91';

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

    let devOtp: string | undefined;
    if (isMsg91Configured()) {
      const sent = await sendOtpSms(mobile, otp);
      if (!sent.ok) {
        await logOtp(mobile, 'failed');
        console.error(`[OTP RESEND] MSG91 failed for ${mobile}: ${sent.error}`);
        return NextResponse.json(
          { success: false, error: 'Could not resend OTP. Please try again.' },
          { status: 502 }
        );
      }
    } else {
      console.log(`[OTP RESEND] Mobile: ${mobile} | OTP: ${otp} (MSG91 not configured)`);
      if (process.env.NODE_ENV === 'development') devOtp = otp;
    }

    return NextResponse.json({
      success: true,
      message: 'OTP resent to your mobile number',
      expiresInSeconds: 600,
      ...(devOtp && { _devOtp: devOtp }),
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
