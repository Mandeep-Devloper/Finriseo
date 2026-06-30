import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { adminSettingsSchema as schema } from '@/lib/validations';

// Update the singleton app settings (id = 1). SUPER_ADMIN only. Audited.
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin(['SUPER_ADMIN']);

    const body = await req.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
    }
    const data = result.data;

    await db.appSetting.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data },
    });

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'settings_update',
      targetType: 'setting',
      targetId: '1',
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
