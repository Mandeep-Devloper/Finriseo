'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../_components/panel.module.css';

export interface SettingsValues {
  businessName: string;
  supportEmail: string;
  supportPhone: string;
  address: string;
  defaultCommissionRate: string;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = (k: keyof SettingsValues, val: string) => setV((p) => ({ ...p, [k]: val }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const rate = v.defaultCommissionRate.trim();
    if (rate !== '' && Number.isNaN(Number(rate))) {
      setError('Default commission rate must be a number.');
      return;
    }

    const payload = {
      businessName: v.businessName.trim() || null,
      supportEmail: v.supportEmail.trim() || null,
      supportPhone: v.supportPhone.trim() || null,
      address: v.address.trim() || null,
      defaultCommissionRate: rate === '' ? null : Number(rate),
    };

    setBusy(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not save settings.');
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {saved && <p className={styles.success}>Settings saved.</p>}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Business information</h2>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Business name</span>
            <input className={styles.input} value={v.businessName} onChange={(e) => set('businessName', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Support email</span>
            <input className={styles.input} type="email" value={v.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>Support phone</span>
            <input className={styles.input} value={v.supportPhone} onChange={(e) => set('supportPhone', e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Address</span>
            <input className={styles.input} value={v.address} onChange={(e) => set('address', e.target.value)} />
          </label>
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Commercials</h2>
        <label className={styles.field}>
          <span className={styles.label}>Default commission rate %</span>
          <input className={styles.input} type="number" step="any" value={v.defaultCommissionRate} onChange={(e) => set('defaultCommissionRate', e.target.value)} />
          <span className={styles.hint}>Used in dashboard commission estimates when a lender has no rate of its own.</span>
        </label>
      </div>

      <div className={styles.actions}>
        <button type="submit" className={styles.primaryBtn} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </form>
  );
}
