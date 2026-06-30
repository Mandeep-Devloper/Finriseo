import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { adminNoteSchema as schema } from '@/lib/validations';

// Add an internal note to an application. All roles may add notes (per the RBAC
// matrix). Audited as note_add. Notes are admin-only and never exposed to borrowers.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, 'add_note')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { referenceId } = await params;
    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const application = await db.application.findUnique({
      where: { referenceId },
      select: { id: true },
    });
    if (!application) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const note = await db.note.create({
      data: {
        applicationId: application.id,
        authorId: admin.id,
        body: result.data.body,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'note_add',
      targetType: 'application',
      targetId: referenceId,
    });

    return NextResponse.json({ success: true, note });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
