import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireSession, unauthorized, SessionError } from '@/lib/auth/session';
import { statusParamSchema as paramSchema } from '@/lib/validations';

const STEP_LABELS = [
  'Application Received',
  'Under Review',
  'Lender Processing',
  'Disbursement',
] as const;

// Maps the stored application status to the index of the step that is
// currently "active". Everything before it is completed, everything after
// is pending. `disbursed` (4) marks every step complete.
const STATUS_TO_ACTIVE: Record<string, number> = {
  draft: 0,
  submitted: 1,
  contacted: 1,
  docs_pending: 1,
  sent_to_lender: 2,
  approved: 2,
  disbursed: 4,
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    if (err instanceof SessionError) return unauthorized();
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }

  const parsed = paramSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Invalid reference ID' }, { status: 400 });
  }
  const { referenceId } = parsed.data;

  const application = await db.application.findUnique({
    where: { referenceId },
    select: { referenceId: true, status: true, mobile: true, createdAt: true, updatedAt: true },
  });

  // 404 for both "missing" and "not owned" so the endpoint can't confirm which
  // reference IDs exist for other users.
  if (!application || application.mobile !== session.phone) {
    return NextResponse.json(
      { success: false, error: 'Application not found' },
      { status: 404 }
    );
  }

  if (application.status === 'rejected') {
    return NextResponse.json({
      success: true,
      referenceId: application.referenceId,
      status: 'rejected',
      steps: STEP_LABELS.map((step, i) => ({
        step,
        status: i === 0 ? 'completed' : 'rejected',
        ...(i === 0 ? { time: application.createdAt.toISOString() } : {}),
      })),
    });
  }

  const active = STATUS_TO_ACTIVE[application.status] ?? 1;

  const steps = STEP_LABELS.map((step, i) => ({
    step,
    status: i < active ? 'completed' : i === active ? 'active' : 'pending',
    ...(i === 0 ? { time: application.createdAt.toISOString() } : {}),
  }));

  return NextResponse.json({
    success: true,
    referenceId: application.referenceId,
    status: application.status,
    updatedAt: application.updatedAt.toISOString(),
    steps,
  });
}
