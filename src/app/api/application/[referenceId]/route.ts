import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { getClientIp } from '@/lib/http/ip';
import { encryptPii } from '@/lib/crypto/pii';
import { reportServerError } from '@/lib/http/errors';
import { requireDraftAccess, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { checkDualRateLimit } from '@/app/api/otp/_otpStore';
import { applicationPatchSchema as schema } from '@/lib/validations';
import type { Prisma } from '@prisma/client';

// Upper bound on the serialized draftData snapshot. It only ever holds a handful
// of short, non-sensitive funnel fields, so 8 KB is generous headroom; anything
// past that is abuse (an authorized draft holder bloating the row), not state.
const MAX_DRAFT_DATA_BYTES = 8 * 1024;

// Progressive save — called after each apply step (and on field blur / debounced
// edits) so the draft is durable and resumable, not only saved at final submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const { referenceId } = await params;
    const headersList = await headers();
    const ip = getClientIp(headersList);

    // Auth first: Firebase OR trusted session, draft-scoped. Also confirms the
    // row exists, is a draft, and is owned by the caller.
    const access = await requireDraftAccess(headersList, referenceId);

    // High limit: progressive-save fires after each step (and on edits/retries),
    // so the ceiling must clear normal funnel use while still blocking abuse.
    const rate = await checkDualRateLimit({ ip, phone: access.mobile, maxRequests: 120, windowMinutes: 60, scope: 'patch' });
    if (!rate.allowed) {
      return NextResponse.json(
        { success: false, error: `Too many requests. Try again in ${Math.ceil((rate.retryAfter ?? 3600) / 60)} minutes.` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const { currentRoute, progressPct, completedSteps, draftData, ...fields } = result.data;

    const data: Prisma.ApplicationUpdateInput = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined)
    );

    // PAN is written ONLY through encryptPii (encrypted at rest when a key is set,
    // passthrough otherwise) — never persisted raw from a progressive save.
    if (typeof data.panNumber === 'string') {
      data.panNumber = encryptPii(data.panNumber) as string;
    }

    // Resume metadata.
    if (currentRoute !== undefined) data.currentRoute = currentRoute;
    if (progressPct !== undefined) data.progressPct = progressPct;
    if (completedSteps !== undefined) data.completedSteps = completedSteps;
    if (draftData !== undefined) {
      // Defensive: PAN must never live in the resumable snapshot.
      const clean = { ...draftData };
      delete (clean as Record<string, unknown>).panNumber;
      // Bound the snapshot size so an authorized draft holder can't bloat the
      // row with arbitrary JSON (the schema caps individual fields but not the
      // whole object).
      if (JSON.stringify(clean).length > MAX_DRAFT_DATA_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Draft snapshot too large' },
          { status: 413 }
        );
      }
      data.draftData = clean as Prisma.InputJsonValue;
    }
    // Any PATCH is activity — refresh the resume clock.
    data.lastActivityAt = new Date();

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No fields to update' }, { status: 400 });
    }

    await db.application.update({ where: { referenceId }, data });
    void recordAudit({ referenceId, actorUid: access.uid, action: 'updated' });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    // Deliberately a 404 (not 500) so this endpoint can't be used to probe which
    // reference IDs exist — but still capture the real cause for the team.
    await reportServerError('application-patch', err);
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }
}
