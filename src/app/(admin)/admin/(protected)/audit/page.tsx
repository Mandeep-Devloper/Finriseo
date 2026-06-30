import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { listAuditLog, getAuditActors } from '@/lib/admin/auditQuery';
import { auditActionLabel } from '@/lib/admin/audit';
import { fmtDateTime } from '@/lib/admin/format';
import { AuditFilters } from './AuditFilters';
import styles from '../../_components/panel.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function AuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, 'audit_view')) {
    return <div className={styles.wrap}><div className={styles.forbidden}>You don’t have access to the audit log.</div></div>;
  }

  const sp = await searchParams;
  const one = (k: string) => { const v = sp[k]; return Array.isArray(v) ? v[0] : v; };

  const page = Math.max(1, parseInt(one('page') ?? '1', 10) || 1);
  const fromRaw = one('from');
  const toRaw = one('to');
  const filters = {
    actorAdminId: one('actorAdminId') || undefined,
    action: one('action') || undefined,
    from: fromRaw ? new Date(`${fromRaw}T00:00:00.000`) : undefined,
    to: toRaw ? new Date(`${toRaw}T23:59:59.999`) : undefined,
  };

  const [{ rows, total, pageCount }, actors] = await Promise.all([
    listAuditLog(filters, page),
    getAuditActors(),
  ]);

  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') next.set(k, v);
    next.set('page', String(p));
    return `/admin/audit?${next.toString()}`;
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Audit log</h1>
          <p className={styles.sub}>{total} event{total === 1 ? '' : 's'}</p>
        </div>
      </header>

      <AuditFilters actors={actors} />

      {rows.length === 0 ? (
        <div className={styles.empty}>No audit events match these filters.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const actor = r.actorAdmin ? r.actorAdmin.name : r.actorUid ? 'Borrower' : 'System';
                const isApp = r.targetType === 'application' || (!r.targetType && r.referenceId);
                return (
                  <tr key={r.id}>
                    <td className={styles.nowrap}>{fmtDateTime(r.createdAt)}</td>
                    <td>
                      {auditActionLabel(r.action)}
                      {r.lender && <span className={styles.muted}> · {r.lender}</span>}
                    </td>
                    <td>{actor}{r.actorAdmin && <span className={styles.muted}> · {r.actorAdmin.email}</span>}</td>
                    <td className={styles.mono}>
                      {isApp ? (
                        <Link href={`/admin/leads/${r.referenceId}`} className={styles.mono}>{r.referenceId}</Link>
                      ) : (
                        <span className={styles.muted}>{r.targetType ?? '—'}{r.targetType ? `:${r.referenceId}` : ''}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={styles.pageBtn}><ChevronLeft size={16} /> Prev</Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}><ChevronLeft size={16} /> Prev</span>
          )}
          <span className={styles.pageInfo}>Page {page} of {pageCount}</span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className={styles.pageBtn}>Next <ChevronRight size={16} /></Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>Next <ChevronRight size={16} /></span>
          )}
        </nav>
      )}
    </div>
  );
}
