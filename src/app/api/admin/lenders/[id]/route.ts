import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { adminLenderUpdateSchema as schema } from '@/lib/validations';

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isFinite(id) ? id : null;
}

// Update a lender (full edit or a partial change like an active toggle).
// SUPER_ADMIN/ADMIN only. Audited as lender_update.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(['SUPER_ADMIN', 'ADMIN']);
    const id = parseId((await params).id);
    if (id == null) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const existing = await db.lender.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const lender = await db.lender.update({ where: { id }, data: result.data });

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'lender_update',
      targetType: 'lender',
      targetId: String(id),
      lender: lender.name,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

// Hard-delete a lender — GUARDED. A lender referenced by any application (as the
// disbursing/chosen lender) can't be deleted, since that would erase the
// disbursement link; the admin should deactivate it instead. Audited as lender_delete.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(['SUPER_ADMIN', 'ADMIN']);
    const id = parseId((await params).id);
    if (id == null) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 });

    const existing = await db.lender.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    const refCount = await db.application.count({ where: { chosenLenderId: id } });
    if (refCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `This lender is linked to ${refCount} application(s). Deactivate it instead of deleting.`,
        },
        { status: 409 }
      );
    }

    await db.lender.delete({ where: { id } });

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'lender_delete',
      targetType: 'lender',
      targetId: String(id),
      lender: existing.name,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
