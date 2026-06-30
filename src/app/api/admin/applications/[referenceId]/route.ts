import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { recordAdminAudit, type AdminAuditAction } from '@/lib/services/auditLog';
import { adminApplicationPatchSchema as schema } from '@/lib/validations';

// Mutations on a single application, discriminated by `op`. Every op is role-gated
// (via the RBAC matrix) and audited. requireAdmin is the auth boundary; the can()
// checks enforce least-privilege per action.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ referenceId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { referenceId } = await params;

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const input = result.data;

    const application = await db.application.findUnique({
      where: { referenceId },
      select: { id: true },
    });
    if (!application) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const forbidden = () =>
      NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });

    let auditAction: AdminAuditAction;
    let lenderLabel: string | undefined;

    switch (input.op) {
      case 'status': {
        if (!can(admin.role, 'change_status')) return forbidden();
        await db.application.update({
          where: { referenceId },
          data: { status: input.status },
        });
        auditAction = 'status_change';
        lenderLabel = input.status; // record the new status in the audit row
        break;
      }

      case 'assign': {
        if (!can(admin.role, 'assign')) return forbidden();
        if (input.assignedToId) {
          const agent = await db.adminUser.findUnique({
            where: { id: input.assignedToId },
            select: { active: true },
          });
          if (!agent || !agent.active) {
            return NextResponse.json(
              { success: false, error: 'Assignee is not an active admin.' },
              { status: 400 }
            );
          }
        }
        await db.application.update({
          where: { referenceId },
          data: { assignedToId: input.assignedToId },
        });
        auditAction = 'assign';
        break;
      }

      case 'disbursement': {
        if (!can(admin.role, 'record_disbursement')) return forbidden();
        const lender = await db.lender.findUnique({
          where: { id: input.chosenLenderId },
          select: { name: true },
        });
        if (!lender) {
          return NextResponse.json(
            { success: false, error: 'Chosen lender does not exist.' },
            { status: 400 }
          );
        }
        // Recording a disbursement implies the loan closed — move to 'disbursed'.
        await db.application.update({
          where: { referenceId },
          data: {
            chosenLenderId: input.chosenLenderId,
            disbursedAmount: input.disbursedAmount,
            disbursedAt: input.disbursedAt,
            status: 'disbursed',
          },
        });
        auditAction = 'disbursement_record';
        lenderLabel = lender.name;
        break;
      }
    }

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: auditAction,
      targetType: 'application',
      targetId: referenceId,
      lender: lenderLabel,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
