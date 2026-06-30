'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { AUDIT_ACTION_LABELS } from '@/lib/admin/audit';
import styles from '../../_components/panel.module.css';

export function AuditFilters({ actors }: { actors: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const get = (k: string) => sp.get(k) ?? '';

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, val] of Object.entries(changes)) {
      if (!val) next.delete(k);
      else next.set(k, val);
    }
    next.delete('page');
    router.push(`${pathname}?${next.toString()}`);
  }

  const hasFilters = ['actorAdminId', 'action', 'from', 'to'].some((k) => sp.get(k));

  return (
    <div className={styles.toolbar}>
      <select className={styles.select} value={get('actorAdminId')} onChange={(e) => update({ actorAdminId: e.target.value })} aria-label="Filter by actor">
        <option value="">Any actor</option>
        {actors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <select className={styles.select} value={get('action')} onChange={(e) => update({ action: e.target.value })} aria-label="Filter by action">
        <option value="">Any action</option>
        {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <input type="date" className={styles.input} value={get('from')} onChange={(e) => update({ from: e.target.value })} aria-label="From date" />
      <input type="date" className={styles.input} value={get('to')} onChange={(e) => update({ to: e.target.value })} aria-label="To date" />

      {hasFilters && (
        <button type="button" className={styles.secondaryBtn} onClick={() => router.push(pathname)}>
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
