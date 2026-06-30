'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../_components/panel.module.css';

// Toggle a contact message between resolved and unread.
export function ResolveButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const resolved = status === 'resolved';

  async function toggle() {
    setBusy(true);
    try {
      await fetch(`/api/admin/contact/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: resolved ? 'unread' : 'resolved' }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className={styles.secondaryBtn} onClick={toggle} disabled={busy}>
      {resolved ? 'Mark unread' : 'Mark resolved'}
    </button>
  );
}
