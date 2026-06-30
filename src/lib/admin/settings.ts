// Singleton app settings (always id = 1). Server-only.
import 'server-only';
import { db } from '@/lib/db';

export function getAppSettings() {
  return db.appSetting.findUnique({ where: { id: 1 } });
}

/** Default commission rate used as a fallback when a lender has none. */
export async function getDefaultCommissionRate(): Promise<number | null> {
  const s = await db.appSetting.findUnique({
    where: { id: 1 },
    select: { defaultCommissionRate: true },
  });
  return s?.defaultCommissionRate ?? null;
}
