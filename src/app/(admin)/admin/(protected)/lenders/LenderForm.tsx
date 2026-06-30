'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EMPLOYMENT_TYPES, LOAN_TYPES } from '@/lib/admin/lenderOptions';
import styles from './lenders.module.css';

export interface LenderFormValues {
  id?: number;
  name: string;
  color: string;
  logoUrl: string;
  processingFee: string;
  priority: string;
  active: boolean;
  interestRate: string;
  interestRateMax: string;
  tenureMonths: string;
  minIncome: string;
  maxMultiplier: string;
  minAmount: string;
  maxAmount: string;
  minAge: string;
  maxAge: string;
  maxFoir: string;
  commissionRate: string;
  employmentTypes: string[];
  loanTypes: string[];
}

export const EMPTY_LENDER: LenderFormValues = {
  name: '', color: '#1A5C32', logoUrl: '', processingFee: '', priority: '0', active: true,
  interestRate: '', interestRateMax: '', tenureMonths: '', minIncome: '0', maxMultiplier: '10',
  minAmount: '', maxAmount: '', minAge: '', maxAge: '', maxFoir: '', commissionRate: '',
  employmentTypes: [], loanTypes: [],
};

const num = (s: string) => Number(s);
const optNum = (s: string) => (s.trim() === '' ? null : Number(s));

export function LenderForm({ initial }: { initial: LenderFormValues }) {
  const router = useRouter();
  const isEdit = initial.id != null;
  const [v, setV] = useState<LenderFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const set = (k: keyof LenderFormValues, value: string | boolean | string[]) =>
    setV((prev) => ({ ...prev, [k]: value }));

  const toggleArray = (k: 'employmentTypes' | 'loanTypes', item: string) =>
    setV((prev) => ({
      ...prev,
      [k]: prev[k].includes(item) ? prev[k].filter((x) => x !== item) : [...prev[k], item],
    }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!v.name.trim() || !v.processingFee.trim() || !v.color.trim()) {
      setError('Name, processing fee and colour are required.');
      return;
    }
    for (const [label, val] of [['Interest rate', v.interestRate], ['Tenure', v.tenureMonths], ['Max multiplier', v.maxMultiplier]] as const) {
      if (val.trim() === '' || Number.isNaN(Number(val))) {
        setError(`${label} must be a number.`);
        return;
      }
    }

    const payload = {
      name: v.name.trim(),
      color: v.color.trim(),
      processingFee: v.processingFee.trim(),
      logoUrl: v.logoUrl.trim() === '' ? null : v.logoUrl.trim(),
      priority: num(v.priority) || 0,
      active: v.active,
      interestRate: num(v.interestRate),
      interestRateMax: optNum(v.interestRateMax),
      tenureMonths: num(v.tenureMonths),
      minIncome: num(v.minIncome) || 0,
      maxMultiplier: num(v.maxMultiplier),
      minAmount: optNum(v.minAmount),
      maxAmount: optNum(v.maxAmount),
      minAge: optNum(v.minAge),
      maxAge: optNum(v.maxAge),
      maxFoir: optNum(v.maxFoir),
      commissionRate: optNum(v.commissionRate),
      employmentTypes: v.employmentTypes,
      loanTypes: v.loanTypes,
    };

    setBusy(true);
    try {
      const res = await fetch(
        isEdit ? `/api/admin/lenders/${initial.id}` : '/api/admin/lenders',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not save the lender.');
        return;
      }
      router.push('/admin/lenders');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!isEdit || deleting) return;
    if (!confirm('Delete this lender permanently? This cannot be undone.')) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/lenders/${initial.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not delete the lender.');
        return;
      }
      router.push('/admin/lenders');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const Field = ({ label, k, type = 'text', placeholder, hint }: {
    label: string; k: keyof LenderFormValues; type?: string; placeholder?: string; hint?: string;
  }) => (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        type={type}
        value={v[k] as string}
        onChange={(e) => set(k, e.target.value)}
        placeholder={placeholder}
        {...(type === 'number' ? { step: 'any' } : {})}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      {error && <p className={styles.formError} role="alert">{error}</p>}

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Basics</legend>
        <div className={styles.row}>
          <Field label="Name" k="name" placeholder="Lender name" />
          <Field label="Processing fee (display)" k="processingFee" placeholder="e.g. 1.5%" />
        </div>
        <div className={styles.row}>
          <Field label="Accent colour" k="color" placeholder="#1A5C32" />
          <Field label="Logo URL" k="logoUrl" placeholder="https://…" />
        </div>
        <div className={styles.row}>
          <Field label="Priority (higher shows first)" k="priority" type="number" />
          <label className={styles.checkRow}>
            <input type="checkbox" checked={v.active} onChange={(e) => set('active', e.target.checked)} />
            <span>Active (visible in borrower offers)</span>
          </label>
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Rates &amp; tenure</legend>
        <div className={styles.row}>
          <Field label="Interest rate % (from)" k="interestRate" type="number" hint="Drives EMI + ordering" />
          <Field label="Interest rate % (to, optional)" k="interestRateMax" type="number" hint="Display range only" />
          <Field label="Tenure (months)" k="tenureMonths" type="number" />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Amount &amp; income</legend>
        <div className={styles.row}>
          <Field label="Min monthly income" k="minIncome" type="number" />
          <Field label="Max multiplier" k="maxMultiplier" type="number" hint="Max loan = income × this" />
        </div>
        <div className={styles.row}>
          <Field label="Min amount (optional)" k="minAmount" type="number" hint="Drops lender if borrower wants less" />
          <Field label="Max amount (optional)" k="maxAmount" type="number" hint="Caps the offered amount" />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Eligibility</legend>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Employment types</span>
          <div className={styles.checks}>
            {EMPLOYMENT_TYPES.map((t) => (
              <label key={t} className={styles.checkChip}>
                <input type="checkbox" checked={v.employmentTypes.includes(t)} onChange={() => toggleArray('employmentTypes', t)} />
                <span>{t}</span>
              </label>
            ))}
          </div>
          <span className={styles.hint}>None selected = available to any employment type.</span>
        </div>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Loan types</span>
          <div className={styles.checks}>
            {LOAN_TYPES.map((t) => (
              <label key={t} className={styles.checkChip}>
                <input type="checkbox" checked={v.loanTypes.includes(t)} onChange={() => toggleArray('loanTypes', t)} />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </div>
        <div className={styles.row}>
          <Field label="Min age (not enforced)" k="minAge" type="number" hint="Funnel collects no age" />
          <Field label="Max age (not enforced)" k="maxAge" type="number" />
          <Field label="Max FOIR % (not enforced)" k="maxFoir" type="number" hint="No obligations collected" />
        </div>
      </fieldset>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>Commercials</legend>
        <div className={styles.row}>
          <Field label="Commission rate %" k="commissionRate" type="number" hint="% of disbursed → dashboard estimates" />
        </div>
      </fieldset>

      <div className={styles.formActions}>
        <button type="submit" className={styles.saveBtn} disabled={busy}>
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Create lender'}
        </button>
        {isEdit && (
          <button type="button" className={styles.deleteBtn} onClick={onDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        )}
        <button type="button" className={styles.cancelBtn} onClick={() => router.push('/admin/lenders')}>
          Cancel
        </button>
      </div>
    </form>
  );
}
