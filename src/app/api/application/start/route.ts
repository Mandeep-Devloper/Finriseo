import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { generateReferenceId } from '@/lib/financial';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { checkDualRateLimit } from '@/app/api/otp/_otpStore';
import { applicationStartSchema as schema } from '@/lib/validations';

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
    const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'unknown';
    // Generous limit: the funnel starts/resumes a draft a handful of times, but
    // this still blocks scripted draft-creation abuse.
    const rate = await checkDualRateLimit({ ip, phone: session.phone, maxRequests: 30, windowMinutes: 60, scope: 'start' });
    if (!rate.allowed) return tooMany(rate.retryAfter);

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const { mobile, fullName, referenceId } = result.data;

    // The owner is whoever the session says it is — never trust the posted
    // mobile. Reject if it doesn't match the OTP-verified number.
    if (mobile !== session.phone) {
      return unauthorized();
    }

    if (referenceId) {
      const existing = await db.application.findUnique({ where: { referenceId } });
      // Only resume a draft the session actually owns.
      if (existing && existing.mobile === session.phone) {
        await db.application.update({ where: { referenceId }, data: { fullName } });
        return NextResponse.json({ success: true, referenceId });
      }
    }

    const newReferenceId = generateReferenceId();
    await db.application.create({
      data: {
        referenceId: newReferenceId,
        mobile: session.phone,
        fullName,
        status: 'draft',
        currentStep: 'otp_verified',
        source: 'web',
      },
    });

    void recordAudit({ referenceId: newReferenceId, actorUid: session.uid, action: 'started' });
    return NextResponse.json({ success: true, referenceId: newReferenceId });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
