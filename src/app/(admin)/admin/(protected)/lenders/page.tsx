import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { fmtMoney } from '@/lib/admin/format';
import { LenderActiveToggle } from './LenderActiveToggle';
import styles from './lenders.module.css';

export const dynamic = 'force-dynamic';

export default async function LendersPage() {
  const admin = await getAdminSession();
  // Page-level capability gate (nav already hides this for agents; this also
  // blocks a direct URL). The APIs enforce it server-side regardless.
  if (!admin || !can(admin.role, 'lender_crud')) {
    return (
      <div className={styles.wrap}>
        <div className={styles.forbidden}>You don’t have access to lender management.</div>
      </div>
    );
  }

  const lenders = await db.lender.findMany({
    orderBy: [{ priority: 'desc' }, { name: 'asc' }],
  });

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Lenders</h1>
          <p className={styles.sub}>{lenders.length} lender{lenders.length === 1 ? '' : 's'} · edits reflect live in borrower offers</p>
        </div>
        <Link href="/admin/lenders/new" className={styles.newBtn}>
          <Plus size={16} /> New lender
        </Link>
      </header>

      {lenders.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No lenders yet</p>
          <p className={styles.emptyText}>Add your first lender to start serving offers.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Rate</th>
                <th className={styles.num}>Tenure</th>
                <th className={styles.num}>Min income</th>
                <th className={styles.num}>Commission</th>
                <th className={styles.num}>Priority</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lenders.map((l) => (
                <tr key={l.id}>
                  <td>
                    <span className={styles.swatch} style={{ background: l.color }} aria-hidden="true" />
                    {l.name}
                  </td>
                  <td className={styles.mono}>
                    {l.interestRate}{l.interestRateMax ? `–${l.interestRateMax}` : ''}%
                  </td>
                  <td className={styles.num}>{l.tenureMonths}m</td>
                  <td className={styles.num}>{fmtMoney(l.minIncome)}</td>
                  <td className={styles.num}>{l.commissionRate != null ? `${l.commissionRate}%` : '—'}</td>
                  <td className={styles.num}>{l.priority}</td>
                  <td><LenderActiveToggle id={l.id} active={l.active} /></td>
                  <td>
                    <Link href={`/admin/lenders/${l.id}/edit`} className={styles.editLink}>
                      <Pencil size={14} /> Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
