'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { Search, Download, X } from 'lucide-react';
import { ALL_STATUSES, statusLabel } from '@/lib/admin/pipeline';
import styles from './leads.module.css';

interface Option { id: string; label: string; }

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'createdAt:desc', label: 'Newest first' },
  { value: 'createdAt:asc', label: 'Oldest first' },
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'loanAmount:desc', label: 'Loan amount: high → low' },
  { value: 'fullName:asc', label: 'Name: A → Z' },
];

export function LeadsToolbar({
  canExport,
  agents,
  lenders,
  purposes,
}: {
  canExport: boolean;
  agents: Option[];
  lenders: Option[];
  purposes: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const get = (k: string) => sp.get(k) ?? '';

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v == null || v === '') next.delete(k);
      else next.set(k, v);
    }
    // Any filter/sort change resets to the first page.
    if (!('page' in changes)) next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  }

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = new FormData(e.currentTarget as HTMLFormElement).get('search');
    update({ search: typeof value === 'string' ? value.trim() : '' });
  }

  const status = get('status');
  const sortValue = `${get('sortBy') || 'createdAt'}:${get('sortDir') || 'desc'}`;
  const hasFilters = ['search', 'status', 'includeDrafts', 'loanPurpose', 'lenderId', 'assignedToId', 'from', 'to'].some((k) => sp.get(k));
  const exportHref = `/api/admin/applications/export?${sp.toString()}`;

  return (
    <div className={styles.toolbar}>
      <form className={styles.searchForm} onSubmit={onSearchSubmit}>
        <Search size={16} className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          name="search"
          defaultValue={get('search')}
          placeholder="Search phone, name or reference ID"
          className={styles.searchInput}
          aria-label="Search leads"
        />
      </form>

      <div className={styles.filters}>
        <select
          className={styles.select}
          value={status}
          onChange={(e) => update({ status: e.target.value, includeDrafts: null })}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={get('assignedToId')}
          onChange={(e) => update({ assignedToId: e.target.value })}
          aria-label="Filter by assigned agent"
        >
          <option value="">Any agent</option>
          <option value="unassigned">Unassigned</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>

        <select
          className={styles.select}
          value={get('lenderId')}
          onChange={(e) => update({ lenderId: e.target.value })}
          aria-label="Filter by lender"
        >
          <option value="">Any lender</option>
          {lenders.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>

        {purposes.length > 0 && (
          <select
            className={styles.select}
            value={get('loanPurpose')}
            onChange={(e) => update({ loanPurpose: e.target.value })}
            aria-label="Filter by loan purpose"
          >
            <option value="">Any purpose</option>
            {purposes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <label className={styles.dateField}>
          <span className={styles.dateLabel}>From</span>
          <input
            type="date"
            className={styles.dateInput}
            value={get('from')}
            onChange={(e) => update({ from: e.target.value })}
            aria-label="Created from date"
          />
        </label>
        <label className={styles.dateField}>
          <span className={styles.dateLabel}>To</span>
          <input
            type="date"
            className={styles.dateInput}
            value={get('to')}
            onChange={(e) => update({ to: e.target.value })}
            aria-label="Created to date"
          />
        </label>

        {!status && (
          <label className={styles.checkField}>
            <input
              type="checkbox"
              checked={get('includeDrafts') === '1'}
              onChange={(e) => update({ includeDrafts: e.target.checked ? '1' : null })}
            />
            <span>Include drafts</span>
          </label>
        )}

        <select
          className={styles.select}
          value={sortValue}
          onChange={(e) => {
            const [sortBy, sortDir] = e.target.value.split(':');
            update({ sortBy, sortDir });
          }}
          aria-label="Sort leads"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {hasFilters && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => router.push(pathname)}
          >
            <X size={14} /> Clear
          </button>
        )}

        {canExport && (
          <a className={styles.exportBtn} href={exportHref}>
            <Download size={15} /> Export CSV
          </a>
        )}
      </div>
    </div>
  );
}
