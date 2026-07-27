import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { generateReferenceId } from '@/lib/financial';
import { getClientIp } from '@/lib/http/ip';
import { CONSENT_VERSION } from '@/lib/constants';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { reportServerError, serverError } from '@/lib/http/errors';
import { recordAudit } from '@/lib/services/auditLog';
import { checkDualRateLimit } from '@/app/api/otp/_otpStore';
import { applicationStartSchema as schema } from '@/lib/validations';
import { createTrustedSession } from '@/lib/auth/trustedSession';
import { computeProgressPct, routeForStep } from '@/lib/application/progress';
import { TRUSTED_ABSOLUTE_TTL_MS } from '@/lib/auth/constants';

// Build the consent record persisted with a draft when the borrower ticked the
// mandatory step-1 consent. Empty object when no consent was signalled, so we
// never overwrite an existing record with nulls.
function consentFields(consent: boolean | undefined, ip: string, userAgent: string) {
  if (!consent) return {};
  return {
    consentAt: new Date(),
    consentVersion: CONSENT_VERSION,
    consentIp: ip,
    consentUserAgent: userAgent.slice(0, 500), // bound stored UA length
  };
}

function tooMany(retryAfter?: number) {
  return NextResponse.json(
    { success: false, error: `Too many requests. Try again in ${Math.ceil((retryAfter ?? 3600) / 60)} minutes.` },
    { status: 429 }
  );
}

// Creates a draft Application row as soon as OTP is verified — this is what
// makes a lead visible in the database from step 1, instead of only at final
// submit. Idempotent: if referenceId already points to an existing draft for
// the same mobile, it just updates the name instead of creating a duplicate.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

    const headersList = await headers();
    const ip = getClientIp(headersList);
    const userAgent = headersList.get('user-agent') ?? '';
    // Generous limit: the funnel starts/resumes a draft a handful of times, but
    // this still blocks scripted draft-creation abuse.
    const rate = await checkDualRateLimit({ ip, phone: session.phone, maxRequests: 30, windowMinutes: 60, scope: 'start' });
    if (!rate.allowed) return tooMany(rate.retryAfter);

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const { mobile, fullName, referenceId, consent, whatsappOptIn } = result.data;
    const consent_ = consentFields(consent, ip, userAgent);
    // Only write the opt-in when the client actually sent a boolean — absence
    // must stay NULL ("no signal"), never be coerced to false.
    const whatsapp_ = typeof whatsappOptIn === 'boolean' ? { whatsappOptIn } : {};

    // The owner is whoever the session says it is — never trust the posted
    // mobile. Reject if it doesn't match the OTP-verified number.
    if (mobile !== session.phone) {
      return unauthorized();
    }

    if (referenceId) {
      const existing = await db.application.findUnique({ where: { referenceId } });
      // Only resume a draft the session actually owns.
      if (existing && existing.mobile === session.phone) {
        await db.application.update({
          where: { referenceId },
          data: {
            fullName,
            // Record consent on resume only if not already captured, so the
            // ORIGINAL consent timestamp is never overwritten.
            ...(existing.consentAt ? {} : consent_),
            // Same idea for the WhatsApp opt-in: keep the first recorded choice.
            ...(existing.whatsappOptIn == null ? whatsapp_ : {}),
          },
        });
        // Bind a trusted-browser session to this draft so this browser can resume
        // with no OTP for the next 7 days.
        await createTrustedSession({ applicationId: existing.id, mobile: session.phone, headers: headersList, ip });
        return NextResponse.json({ success: true, referenceId });
      }
    }

    const newReferenceId = generateReferenceId();

    // Look for previous draft(s) for this phone to restore form data
    const previousDraft = await db.application.findFirst({
      where: { mobile: session.phone, status: 'draft' },
      orderBy: { createdAt: 'desc' },
    });

    const created = await db.application.create({
      data: {
        referenceId: newReferenceId,
        mobile: session.phone,
        fullName,
        status: 'draft',
        currentStep: 'otp_verified',
        currentRoute: routeForStep('otp_verified'),
        completedSteps: ['otp_verified'],
        progressPct: computeProgressPct(['otp_verified']),
        lastActivityAt: new Date(),
        // Draft purge horizon for the retention job (matches the trusted-session
        // absolute cap so a resumable draft always outlives its trusted session).
        expiresAt: new Date(Date.now() + TRUSTED_ABSOLUTE_TTL_MS),
        source: 'web',
        // Restore form data from previous draft if it exists
        ...(previousDraft?.draftData ? { draftData: previousDraft.draftData } : {}),
        // Restore other pre-filled fields from previous draft
        ...(previousDraft?.email ? { email: previousDraft.email } : {}),
        ...(previousDraft?.pinCode ? { pinCode: previousDraft.pinCode } : {}),
        ...(previousDraft?.employmentType ? { employmentType: previousDraft.employmentType } : {}),
        ...(previousDraft?.monthlyIncome ? { monthlyIncome: previousDraft.monthlyIncome } : {}),
        ...(previousDraft?.salaryMode ? { salaryMode: previousDraft.salaryMode } : {}),
        ...(previousDraft?.employer ? { employer: previousDraft.employer } : {}),
        ...(previousDraft?.experience ? { experience: previousDraft.experience } : {}),
        ...(previousDraft?.loanAmount ? { loanAmount: previousDraft.loanAmount } : {}),
        ...(previousDraft?.loanPurpose ? { loanPurpose: previousDraft.loanPurpose } : {}),
        ...consent_,
        ...whatsapp_,
      },
    });

    // Bind the trusted-browser session to the freshly created draft.
    await createTrustedSession({ applicationId: created.id, mobile: session.phone, headers: headersList, ip });

    void recordAudit({ referenceId: newReferenceId, actorUid: session.uid, action: 'started' });
    return NextResponse.json({ success: true, referenceId: newReferenceId });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    await reportServerError('application-start', err);
    return serverError();
  }
}
