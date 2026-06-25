import { NextRequest, NextResponse } from 'next/server';
import { generateReferenceId } from '@/lib/financial';
import { db } from '@/lib/db';
import { checkIpRateLimit, checkPhoneRateLimit, maskPhone } from '@/app/api/otp/_otpStore';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { resolveSubmission } from '@/lib/services/eligibility';
import { applicationSubmitSchema as schema } from '@/lib/validations';
import { headers } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

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

    const phoneCheck = await checkPhoneRateLimit(session.phone, 5, 60, 'submit'); // 5 per hour per phone
    if (!phoneCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many submissions. Try again in ${Math.ceil((phoneCheck.retryAfter ?? 3600) / 60)} minutes.`
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data' },
        { status: 400 }
      );
    }
    const d = result.data;

    // The owner is the session, never the posted mobile.
    if (d.mobile !== session.phone) {
      return unauthorized();
    }

    // Never trust the client's loanAmount / selectedOfferId as authoritative.
    // Re-derive them from the live Lender table: clamp the amount to what the
    // applicant is actually eligible for, and reject an offer they don't qualify
    // for (tampering). Same logic that produced the offers they saw.
    const resolved = await resolveSubmission({
      loanAmount: d.loanAmount,
      monthlyIncome: d.monthlyIncome,
      selectedOfferId: d.selectedOfferId,
    });
    if (!resolved.ok) {
      return NextResponse.json({ success: false, error: resolved.error }, { status: 400 });
    }

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
      loanAmount: resolved.loanAmount,
      loanPurpose: d.loanPurpose ?? null,
      panNumber: d.panNumber ?? null,
      selectedOfferId: resolved.selectedOfferId,
      status: 'submitted',
      currentStep: 'submitted',
    };

    let referenceId = d.referenceId;
    const existing = referenceId
      ? await db.application.findUnique({ where: { referenceId } })
      : null;

    // Refuse to overwrite a draft the session doesn't own.
    if (existing && existing.mobile !== session.phone) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    if (existing) {
      await db.application.update({ where: { referenceId: existing.referenceId }, data: fieldData });
    } else {
      // No draft found (funnel was skipped or referenceId got lost) — create fresh.
      referenceId = generateReferenceId();
      await db.application.create({ data: { referenceId, source: 'web', ...fieldData } });
    }

    void recordAudit({
      referenceId: referenceId!,
      actorUid: session.uid,
      action: 'submitted',
      lender: resolved.selectedOfferId != null ? String(resolved.selectedOfferId) : undefined,
    });

    console.log(`[APPLICATION] ${referenceId} | Mobile: ${maskPhone(session.phone)}`);
    return NextResponse.json({
      success: true,
      referenceId,
      message: 'Application submitted. Team will contact you in 10 minutes.',
    });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
