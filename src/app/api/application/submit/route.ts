import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateReferenceId } from '@/lib/financial';
import { db } from '@/lib/db';
import { checkIpRateLimit } from '@/app/api/otp/_otpStore';
import { headers } from 'next/headers';

const schema = z.object({
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  fullName: z.string().min(2),
  employmentType: z.string().min(1),
  monthlyIncome: z.coerce.number().positive(),
  employer: z.string().optional(),
  experience: z.string().optional(),
  loanAmount: z.coerce.number().positive(),
  loanPurpose: z.string().optional(),
  selectedOfferId: z.number().optional(),
});



export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')
      ?? headersList.get('x-real-ip')
      ?? 'unknown';

    const ipCheck = checkIpRateLimit(ip, 5, 60); // 5 submits per hour per IP
    if (!ipCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many submissions. Try again in ${Math.ceil((ipCheck.retryAfter ?? 3600) / 60)} minutes.`
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data', details: result.error.flatten() },
        { status: 400 }
      );
    }
    const referenceId = generateReferenceId();
    await db.application.create({
      data: {
        referenceId,
        mobile: result.data.mobile,
        fullName: result.data.fullName,
        employmentType: result.data.employmentType,
        monthlyIncome: result.data.monthlyIncome,
        employer: result.data.employer ?? null,
        experience: result.data.experience ?? null,
        loanAmount: result.data.loanAmount,
        loanPurpose: result.data.loanPurpose ?? null,
        selectedOfferId: result.data.selectedOfferId,
        status: 'submitted',
        source: 'web',
      },
    });
    console.log(`[APPLICATION] ${referenceId} | Mobile: ${result.data.mobile}`);
    return NextResponse.json({
      success: true,
      referenceId,
      message: 'Application submitted. Team will contact you in 10 minutes.',
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
