import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { adminLenderCreateSchema as schema } from '@/lib/validations';

// Create a lender. Restricted to SUPER_ADMIN/ADMIN (lender_crud). Edits to the
// Lender table feed the borrower offers engine live (same table the eligibility
// service reads). Audited as lender_create.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(['SUPER_ADMIN', 'ADMIN']);

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }

    const lender = await db.lender.create({ data: result.data });

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'lender_create',
      targetType: 'lender',
      targetId: String(lender.id),
      lender: lender.name,
    });

    return NextResponse.json({ success: true, id: lender.id });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
