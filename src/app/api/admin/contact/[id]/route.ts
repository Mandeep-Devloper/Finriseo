import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { recordAdminAudit } from '@/lib/services/auditLog';

// Mark a contact/grievance message resolved (or back to unread). ADMIN+. Audited.
const schema = z.object({ status: z.enum(['unread', 'resolved']) });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, 'contact_inbox')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }
    const { id } = await params;

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const existing = await db.contactMessage.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    await db.contactMessage.update({ where: { id }, data: { status: result.data.status } });

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'contact_resolve',
      targetType: 'contact',
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
