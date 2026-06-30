import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { adminUserUpdateSchema as schema } from '@/lib/validations';

// Change an admin's role and/or active flag. SUPER_ADMIN only.
// Guards: (1) you can't change your own role/status (lockout safety);
//         (2) the last active SUPER_ADMIN can't be demoted/deactivated.
// Deactivating revokes the user's Firebase refresh tokens so their session dies.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(['SUPER_ADMIN']);
    const { id } = await params;

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const { role, active } = result.data;

    if (id === admin.id) {
      return NextResponse.json(
        { success: false, error: 'You can’t change your own role or status.' },
        { status: 400 }
      );
    }

    const target = await db.adminUser.findUnique({ where: { id } });
    if (!target) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Don't strip the last active SUPER_ADMIN of access.
    const losingSuper =
      target.role === 'SUPER_ADMIN' && ((role !== undefined && role !== 'SUPER_ADMIN') || active === false);
    if (losingSuper) {
      const activeSupers = await db.adminUser.count({ where: { role: 'SUPER_ADMIN', active: true } });
      if (activeSupers <= 1) {
        return NextResponse.json(
          { success: false, error: 'Cannot remove the last active super admin.' },
          { status: 400 }
        );
      }
    }

    await db.adminUser.update({
      where: { id },
      data: {
        ...(role !== undefined ? { role } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });

    // Revoking access should end any live session immediately.
    if (active === false) {
      try {
        await getAdminAuth().revokeRefreshTokens(target.firebaseUid);
      } catch {
        /* non-fatal: getAdminSession also re-checks `active` on every request */
      }
    }

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: active === false ? 'user_deactivate' : 'user_update',
      targetType: 'admin_user',
      targetId: id,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
