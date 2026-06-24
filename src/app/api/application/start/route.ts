import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateReferenceId } from '@/lib/financial';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { applicationStartSchema as schema } from '@/lib/validations';

// Creates a draft Application row as soon as OTP is verified — this is what
// makes a lead visible in the database from step 1, instead of only at final
// submit. Idempotent: if referenceId already points to an existing draft for
// the same mobile, it just updates the name instead of creating a duplicate.
export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();

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
