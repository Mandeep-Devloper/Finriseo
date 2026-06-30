'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { can } from '@/lib/auth/permissions';
import { PIPELINE_STATUSES, statusLabel } from '@/lib/admin/pipeline';
import styles from './detail.module.css';

interface Agent { id: string; name: string; }
interface Lender { id: number; name: string; }

export function LeadActions({
  referenceId,
  role,
  status,
  assignedToId,
  agents,
  lenders,
  disbursement,
}: {
  referenceId: string;
  role: Role;
  status: string;
  assignedToId: string | null;
  agents: Agent[];
  lenders: Lender[];
  disbursement: { chosenLenderId: number | null; amount: number | null; date: string | null };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const base = `/api/admin/applications/${referenceId}`;

  async function send(key: string, url: string, init: RequestInit) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Something went wrong.');
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  // Local state for the note + disbursement forms.
  const [note, setNote] = useState('');
  const [disLender, setDisLender] = useState(String(disbursement.chosenLenderId ?? ''));
  const [disAmount, setDisAmount] = useState(disbursement.amount != null ? String(disbursement.amount) : '');
  const [disDate, setDisDate] = useState(disbursement.date ?? '');

  return (
    <div className={styles.actions}>
      <h2 className={styles.cardTitle}>Actions</h2>

      {error && <p className={styles.actionError} role="alert">{error}</p>}

      {can(role, 'change_status') && (
        <div className={styles.actionBlock}>
          <label className={styles.actionLabel} htmlFor="status">Status</label>
          <select
            id="status"
            className={styles.actionSelect}
            defaultValue={status}
            disabled={busy === 'status'}
            onChange={(e) =>
              send('status', base, {
                method: 'PATCH',
                body: JSON.stringify({ op: 'status', status: e.target.value }),
              })
            }
          >
            {/* Show the true current status even if it's pre-pipeline (e.g. draft) */}
            {!PIPELINE_STATUSES.includes(status as (typeof PIPELINE_STATUSES)[number]) && (
              <option value={status} disabled>{statusLabel(status)} (current)</option>
            )}
            {PIPELINE_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel(s)}</option>
            ))}
          </select>
        </div>
      )}

      {can(role, 'assign') && (
        <div className={styles.actionBlock}>
          <label className={styles.actionLabel} htmlFor="assign">Assigned agent</label>
          <select
            id="assign"
            className={styles.actionSelect}
            defaultValue={assignedToId ?? ''}
            disabled={busy === 'assign'}
            onChange={(e) =>
              send('assign', base, {
                method: 'PATCH',
                body: JSON.stringify({ op: 'assign', assignedToId: e.target.value || null }),
              })
            }
          >
            <option value="">Unassigned</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {can(role, 'add_note') && (
        <form
          className={styles.actionBlock}
          onSubmit={async (e) => {
            e.preventDefault();
            if (!note.trim()) return;
            const ok = await send('note', `${base}/notes`, {
              method: 'POST',
              body: JSON.stringify({ body: note.trim() }),
            });
            if (ok) setNote('');
          }}
        >
          <label className={styles.actionLabel} htmlFor="note">Add note</label>
          <textarea
            id="note"
            className={styles.actionTextarea}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Internal note (not visible to the borrower)"
            maxLength={2000}
          />
          <button type="submit" className={styles.actionBtn} disabled={busy === 'note' || !note.trim()}>
            {busy === 'note' ? 'Adding…' : 'Add note'}
          </button>
        </form>
      )}

      {can(role, 'record_disbursement') && (
        <form
          className={styles.actionBlock}
          onSubmit={(e) => {
            e.preventDefault();
            if (!disLender || !disAmount || !disDate) {
              setError('Lender, amount and date are all required.');
              return;
            }
            send('disbursement', base, {
              method: 'PATCH',
              body: JSON.stringify({
                op: 'disbursement',
                chosenLenderId: Number(disLender),
                disbursedAmount: Number(disAmount),
                disbursedAt: disDate,
              }),
            });
          }}
        >
          <label className={styles.actionLabel}>Record disbursement</label>
          <select
            className={styles.actionSelect}
            value={disLender}
            onChange={(e) => setDisLender(e.target.value)}
          >
            <option value="">Select lender…</option>
            {lenders.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <input
            type="number"
            className={styles.actionInput}
            value={disAmount}
            onChange={(e) => setDisAmount(e.target.value)}
            placeholder="Disbursed amount (₹)"
            min={1}
          />
          <input
            type="date"
            className={styles.actionInput}
            value={disDate}
            onChange={(e) => setDisDate(e.target.value)}
          />
          <button type="submit" className={styles.actionBtn} disabled={busy === 'disbursement'}>
            {busy === 'disbursement' ? 'Saving…' : 'Save disbursement'}
          </button>
          <p className={styles.actionHint}>Saving marks the lead as Disbursed.</p>
        </form>
      )}
    </div>
  );
}
