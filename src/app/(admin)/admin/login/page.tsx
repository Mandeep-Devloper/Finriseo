'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  setPersistence,
  inMemoryPersistence,
  signOut,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase-client';
import styles from './login.module.css';

// Admin login. The Firebase client SDK verifies email/password and returns an ID
// token; we post it to /api/admin/auth/login, which mints the httpOnly admin
// session cookie after confirming an active AdminUser. We use in-memory
// persistence + sign out the client SDK afterwards so the ONLY durable session
// is our server cookie — the browser never holds a Firebase admin session.
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const auth = getClientAuth();
    try {
      await setPersistence(auth, inMemoryPersistence);
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();

      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      // We never need the client-side Firebase session again — the server cookie
      // is authoritative. Clear it regardless of outcome.
      await signOut(auth).catch(() => {});

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? 'Could not sign in. Please try again.');
        setLoading(false);
        return;
      }

      // Full navigation so the protected layout re-runs requireAdmin server-side.
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      // Generic message — never reveal whether the email exists / is an admin.
      const code = (err as { code?: string })?.code ?? '';
      setError(
        code === 'auth/too-many-requests'
          ? 'Too many attempts. Please try again later.'
          : 'Invalid email or password.'
      );
      await signOut(auth).catch(() => {});
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logoMark}>F</span>
          <span className={styles.logoText}>Finriseo</span>
        </div>
        <h1 className={styles.title}>Admin sign in</h1>
        <p className={styles.subtitle}>Restricted access. Authorized staff only.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="you@finriseo.com"
              disabled={loading}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="••••••••"
              disabled={loading}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
