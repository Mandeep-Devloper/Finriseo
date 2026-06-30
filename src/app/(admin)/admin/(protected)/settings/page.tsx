import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { getAppSettings } from '@/lib/admin/settings';
import { SettingsForm, type SettingsValues } from './SettingsForm';
import styles from '../../_components/panel.module.css';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, 'settings')) {
    return <div className={styles.wrap}><div className={styles.forbidden}>You don’t have access to settings.</div></div>;
  }

  const s = await getAppSettings();
  const initial: SettingsValues = {
    businessName: s?.businessName ?? '',
    supportEmail: s?.supportEmail ?? '',
    supportPhone: s?.supportPhone ?? '',
    address: s?.address ?? '',
    defaultCommissionRate: s?.defaultCommissionRate != null ? String(s.defaultCommissionRate) : '',
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Settings</h1>
          <p className={styles.sub}>Business info and default commission</p>
        </div>
      </header>
      <SettingsForm initial={initial} />
    </div>
  );
}
