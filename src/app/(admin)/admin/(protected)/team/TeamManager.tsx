'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import type { Role } from '@prisma/client';
import styles from '../../_components/panel.module.css';

const ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'AGENT'];
const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  AGENT: 'Agent',
};

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
}

export function TeamManager({
  members,
  currentAdminId,
}: {
  members: TeamMember[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('AGENT');
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteLink(null);
    if (!email.trim() || name.trim().length < 2) {
      setError('Enter a valid email and a name (2+ characters).');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/admin/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? 'Could not send the invite.');
        return;
      }
      setInviteLink(data?.link ?? null);
      setEmail('');
      setName('');
      setRole('AGENT');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function patchMember(id: string, payload: { role?: Role; active?: boolean }) {
    setError(null);
    setRowBusy(id);
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not update.');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setRowBusy(null);
    }
  }

  return (
    <>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Invite admin or agent</h2>
        <form className={styles.form} onSubmit={invite}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Email</span>
              <input className={styles.input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="person@finriseo.com" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Role</span>
              <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </label>
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryBtn} disabled={busy}>
              <UserPlus size={15} /> {busy ? 'Inviting…' : 'Send invite'}
            </button>
          </div>
        </form>

        {inviteLink && (
          <div>
            <p className={styles.success}>Invite created. Share this one-time password-set link:</p>
            <div className={styles.linkBox}>
              <input className={styles.linkInput} readOnly value={inviteLink} onFocus={(e) => e.currentTarget.select()} />
            </div>
          </div>
        )}
        {inviteLink === null && !error && (
          <p className={styles.hint} style={{ marginTop: '0.5rem' }}>
            The invitee gets a Firebase account; share the generated link so they can set a password.
          </p>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.id === currentAdminId;
              return (
                <tr key={m.id}>
                  <td>{m.name}{isSelf && <span className={styles.muted}> (you)</span>}</td>
                  <td className={styles.mono}>{m.email}</td>
                  <td>
                    <select
                      className={styles.select}
                      value={m.role}
                      disabled={isSelf || rowBusy === m.id}
                      onChange={(e) => patchMember(m.id, { role: e.target.value as Role })}
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${m.active ? styles.badgeGreen : styles.badgeGray}`}>
                      {m.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className={styles.nowrap}>
                    {!isSelf && (
                      <button
                        type="button"
                        className={m.active ? styles.dangerBtn : styles.secondaryBtn}
                        disabled={rowBusy === m.id}
                        onClick={() => patchMember(m.id, { active: !m.active })}
                      >
                        {m.active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
