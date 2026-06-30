import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAdminAuth } from '@/lib/firebase-admin';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { adminInviteSchema as schema } from '@/lib/validations';

// Invite a new admin/agent. SUPER_ADMIN only. Mirrors the bootstrap CLI: create
// (or reuse) the Firebase user, create the AdminUser row, and return a one-time
// password-set link for the SUPER_ADMIN to share (no email infra assumed).
// Audited as user_invite.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(['SUPER_ADMIN']);

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const email = result.data.email.toLowerCase();
    const { name, role } = result.data;

    if (await db.adminUser.findUnique({ where: { email } })) {
      return NextResponse.json({ success: false, error: 'That email is already an admin.' }, { status: 409 });
    }

    const auth = getAdminAuth();
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (err) {
      if ((err as { code?: string })?.code === 'auth/user-not-found') {
        user = await auth.createUser({ email, displayName: name, emailVerified: false });
      } else {
        throw err;
      }
    }

    if (await db.adminUser.findUnique({ where: { firebaseUid: user.uid } })) {
      return NextResponse.json({ success: false, error: 'That account is already an admin.' }, { status: 409 });
    }

    const created = await db.adminUser.create({
      data: { email, firebaseUid: user.uid, name, role, active: true },
    });

    let link: string | null = null;
    try {
      link = await auth.generatePasswordResetLink(email);
    } catch {
      // Non-fatal: the admin row exists; the SUPER_ADMIN can resend a link later.
    }

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'user_invite',
      targetType: 'admin_user',
      targetId: created.id,
    });

    return NextResponse.json({ success: true, link });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
