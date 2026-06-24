import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { recordAudit } from '@/lib/services/auditLog';
import { applicationPatchSchema as schema } from '@/lib/validations';

// Progressive save — called after each apply step so the lead's data is
// visible in the database immediately, not only after final submit.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const session = await requireSession();
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
    return NextResponse.json({ success: false, error: 'Application not found' }, { status: 404 });
  }
}
