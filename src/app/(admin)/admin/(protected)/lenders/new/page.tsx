import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { LenderForm, EMPTY_LENDER } from '../LenderForm';
import styles from '../lenders.module.css';

export const dynamic = 'force-dynamic';

export default async function NewLenderPage() {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, 'lender_crud')) {
    return <div className={styles.wrap}><div className={styles.forbidden}>You don’t have access to lender management.</div></div>;
  }

  return (
    <div className={styles.wrap}>
      <Link href="/admin/lenders" className={styles.back}><ChevronLeft size={16} /> Back to lenders</Link>
      <h1 className={styles.title}>New lender</h1>
      <LenderForm initial={EMPTY_LENDER} />
    </div>
  );
}
