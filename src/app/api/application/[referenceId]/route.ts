import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getClientIp } from '@/lib/http/ip';
import { encryptPii } from '@/lib/crypto/pii';
import { reportServerError } from '@/lib/http/errors';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { checkDualRateLimit } from '@/app/api/otp/_otpStore';
import { applicationPatchSchema as schema } from '@/lib/validations';

// Progressive save — called after each apply step so the lead's data is
// visible in the database immediately, not only after final submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const session = await requireSession();

    const headersList = await headers();
    const ip = getClientIp(headersList);
    // High limit: progressive-save fires after each step (and on edits/retries),
    // so the ceiling must clear normal funnel use while still blocking abuse.
    const rate = await checkDualRateLimit({ ip, phone: session.phone, maxRequests: 120, windowMinutes: 60, scope: 'patch' });
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Try again in ${Math.ceil((rate.retryAfter ?? 3600) / 60)} minutes.` },
        { status: 429 }
      );
    }

    const { referenceId } = await params;
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const data = Object.fromEntries(
      Object.entries(result.data).filter(([, v]) => v !== undefined)
    );
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    // PAN is written ONLY through encryptPii (encrypted at rest when a key is set,
    // passthrough otherwise) — never persisted raw from a progressive save.
    if (typeof data.panNumber === 'string') {
      // Non-empty PAN string → always returns a string (encrypted or passthrough).
      data.panNumber = encryptPii(data.panNumber) as string;
    }

    // Authorize: the session must own this application. Use a 404 for both
    // "missing" and "not yours" so the endpoint can't be used to probe which
    // reference IDs exist.
    const existing = await db.application.findUnique({
      where: { referenceId },
      select: { mobile: true },
    });
    if (!existing || existing.mobile !== session.phone) {
      return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
    }

    await db.application.update({ where: { referenceId }, data });
    void recordAudit({ referenceId, actorUid: session.uid, action: 'updated' });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    // Deliberately a 404 (not 500) so this endpoint can't be used to probe which
    // reference IDs exist — but still capture the real cause for the team.
    await reportServerError('application-patch', err);
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }
}
