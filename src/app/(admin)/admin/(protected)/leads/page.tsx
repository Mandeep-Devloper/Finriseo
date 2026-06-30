import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import {
  parseLeadQuery,
  listApplications,
  getFilterOptions,
  getAssignableAgents,
} from '@/lib/admin/applications';
import { fmtDate, fmtMoney } from '@/lib/admin/format';
import { StatusBadge } from '../../_components/StatusBadge';
import { LeadsToolbar } from './LeadsToolbar';
import styles from './leads.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const get = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const query = parseLeadQuery(get);
  const [admin, result, options, agents] = await Promise.all([
    getAdminSession(),
    listApplications(query),
    getFilterOptions(),
    getAssignableAgents(),
  ]);

  const canExport = admin ? can(admin.role, 'export') : false;
  const { rows, total, page, pageCount } = result;

  // Build a pagination href that preserves the current filters.
  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === 'string') next.set(k, v);
    }
    next.set('page', String(p));
    return `/admin/leads?${next.toString()}`;
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Leads</h1>
          <p className={styles.sub}>{total} application{total === 1 ? '' : 's'}</p>
        </div>
      </header>

      <LeadsToolbar
        canExport={canExport}
        agents={agents.map((a) => ({ id: a.id, label: a.name }))}
        lenders={options.lenders.map((l) => ({ id: String(l.id), label: l.name }))}
        purposes={options.purposes}
      />

      {rows.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyTitle}>No leads match these filters</p>
          <p className={styles.emptyText}>Try clearing the search or widening the date range.</p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Name</th>
                <th>Mobile</th>
                <th className={styles.num}>Loan amount</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={styles.row}>
                  <td>
                    <Link href={`/admin/leads/${r.referenceId}`} className={styles.refLink}>
                      {r.referenceId}
                    </Link>
                  </td>
                  <td>{r.fullName}</td>
                  <td className={styles.mono}>{r.mobile}</td>
                  <td className={styles.num}>{fmtMoney(r.loanAmount)}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{r.assignedTo?.name ?? <span className={styles.muted}>Unassigned</span>}</td>
                  <td className={styles.muted}>{fmtDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav className={styles.pagination} aria-label="Pagination">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className={styles.pageBtn}>
              <ChevronLeft size={16} /> Prev
            </Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>
              <ChevronLeft size={16} /> Prev
            </span>
          )}
          <span className={styles.pageInfo}>Page {page} of {pageCount}</span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className={styles.pageBtn}>
              Next <ChevronRight size={16} />
            </Link>
          ) : (
            <span className={`${styles.pageBtn} ${styles.pageBtnDisabled}`}>
              Next <ChevronRight size={16} />
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
