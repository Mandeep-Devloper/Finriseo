'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './lenders.module.css';

// Inline active/inactive toggle in the lenders list. PATCHes {active} and
// refreshes so the change reflects immediately (and in borrower offers).
export function LenderActiveToggle({ id, active }: { id: number; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/admin/lenders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !active }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`${styles.toggle} ${active ? styles.toggleOn : styles.toggleOff}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={active}
    >
      {active ? 'Active' : 'Inactive'}
    </button>
  );
}
