import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateReferenceId } from '@/lib/financial';
import { db } from '@/lib/db';
import { checkIpRateLimit } from '@/app/api/otp/_otpStore';
import { headers } from 'next/headers';

const schema = z.object({
  referenceId: z.string().optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/),
  fullName: z.string().min(2),
  email: z.string().email().optional(),
  pinCode: z.string().regex(/^\d{6}$/).optional(),
  employmentType: z.string().min(1),
  monthlyIncome: z.coerce.number().positive(),
  salaryMode: z.string().optional(),
  employer: z.string().optional(),
  experience: z.string().optional(),
  loanAmount: z.coerce.number().positive(),
  loanPurpose: z.string().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/).optional(),
  selectedOfferId: z.number().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const ip = headersList.get('x-forwarded-for')
      ?? headersList.get('x-real-ip')
      ?? 'unknown';

    const ipCheck = await checkIpRateLimit(ip, 5, 60, 'submit'); // 5 submits per hour per IP
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
    const d = result.data;

    const fieldData = {
      mobile: d.mobile,
      fullName: d.fullName,
      email: d.email ?? null,
      pinCode: d.pinCode ?? null,
      employmentType: d.employmentType,
      monthlyIncome: d.monthlyIncome,
      salaryMode: d.salaryMode ?? null,
      employer: d.employer ?? null,
      experience: d.experience ?? null,
      loanAmount: d.loanAmount,
      loanPurpose: d.loanPurpose ?? null,
      panNumber: d.panNumber ?? null,
      selectedOfferId: d.selectedOfferId,
      status: 'submitted',
      currentStep: 'submitted',
    };

    let referenceId = d.referenceId;
    const existing = referenceId
      ? await db.application.findUnique({ where: { referenceId } })
      : null;

    if (existing) {
      await db.application.update({ where: { referenceId: existing.referenceId }, data: fieldData });
    } else {
      // No draft found (funnel was skipped or referenceId got lost) — create fresh.
      referenceId = generateReferenceId();
      await db.application.create({ data: { referenceId, source: 'web', ...fieldData } });
    }

    console.log(`[APPLICATION] ${referenceId} | Mobile: ${d.mobile}`);
    return NextResponse.json({
      success: true,
      referenceId,
      message: 'Application submitted. Team will contact you in 10 minutes.',
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
