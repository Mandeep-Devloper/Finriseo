import { NextRequest, NextResponse } from 'next/server';
import { generateReferenceId } from '@/lib/financial';
import { db } from '@/lib/db';
import { getClientIp } from '@/lib/http/ip';
import { encryptPii } from '@/lib/crypto/pii';
import { checkIpRateLimit, checkPhoneRateLimit, maskPhone } from '@/app/api/otp/_otpStore';
import { requireSession, requireDraftAccess, unauthorized, SessionError } from '@/lib/auth/session';
import { revokeTrustedSession } from '@/lib/auth/trustedSession';
import { reportServerError, serverError } from '@/lib/http/errors';
import { recordAudit } from '@/lib/services/auditLog';
import { resolveSubmission } from '@/lib/services/eligibility';
import { applicationSubmitSchema as schema } from '@/lib/validations';
import { headers } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const headersList = await headers();
    const ip = getClientIp(headersList);

    // Peek referenceId to choose the auth path (schema validation happens below).
    const raw = await req.json();
    const refId: string | undefined = typeof raw?.referenceId === 'string' ? raw.referenceId : undefined;

    // A submit that targets an existing draft may be authorized by the trusted
    // session (zero-friction finish on resume). A submit with NO draft to attach
    // to must present a real Firebase session.
    let ownerMobile: string;
    let actorUid: string | undefined;
    if (refId) {
      const access = await requireDraftAccess(headersList, refId);
      ownerMobile = access.mobile;
      actorUid = access.uid;
    } else {
      const session = await requireSession();
      ownerMobile = session.phone;
      actorUid = session.uid;
    }

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

    const phoneCheck = await checkPhoneRateLimit(ownerMobile, 5, 60, 'submit'); // 5 per hour per phone
    if (!phoneCheck.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Too many submissions. Try again in ${Math.ceil((phoneCheck.retryAfter ?? 3600) / 60)} minutes.`
        },
        { status: 429 }
      );
    }

    const result = schema.safeParse(raw);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid data' },
        { status: 400 }
      );
    }
    const d = result.data;

    // The owner is the authorized session, never the posted mobile.
    if (d.mobile !== ownerMobile) {
      return unauthorized();
    }

    // Never trust the client's loanAmount / selectedOfferId as authoritative.
    // Re-derive them from the live Lender table: clamp the amount to what the
    // applicant is actually eligible for, and reject an offer they don't qualify
    // for (tampering). Same logic that produced the offers they saw.
    const resolved = await resolveSubmission({
      loanAmount: d.loanAmount,
      monthlyIncome: d.monthlyIncome,
      employmentType: d.employmentType,
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
      // PAN is written ONLY through encryptPii (AES-256-GCM when a key is set,
      // passthrough otherwise) — never stored raw from the request.
      panNumber: encryptPii(d.panNumber ?? null),
      selectedOfferId: resolved.selectedOfferId,
      status: 'submitted',
      currentStep: 'submitted',
    };

    let referenceId = d.referenceId;
    const existing = referenceId
      ? await db.application.findUnique({ where: { referenceId } })
      : null;

    // Refuse to overwrite a draft the session doesn't own.
    if (existing && existing.mobile !== ownerMobile) {
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
      actorUid,
      action: 'submitted',
      lender: resolved.selectedOfferId != null ? String(resolved.selectedOfferId) : undefined,
    });

    // The draft is now submitted — retire the trusted session so the 7-day cookie
    // can never re-open a completed application.
    await revokeTrustedSession();

    console.log(`[APPLICATION] ${referenceId} | Mobile: ${maskPhone(ownerMobile)}`);
    return NextResponse.json({
      success: true,
      referenceId,
      message: 'Application submitted. Team will contact you in 10 minutes.',
    });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    await reportServerError('application-submit', err);
    return serverError();
  }
}
