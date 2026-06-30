'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import type { Role } from '@prisma/client';
import { can } from '@/lib/auth/permissions';
import { NAV_ITEMS } from './nav';
import styles from './AdminShell.module.css';

interface AdminInfo {
  name: string;
  email: string;
  role: Role;
}

const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  AGENT: 'Agent',
};

export function AdminShell({
  admin,
  children,
}: {
  admin: AdminInfo;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Only show nav the role is actually allowed to use (mirror of the server gate).
  const items = NAV_ITEMS.filter((item) => can(admin.role, item.capability));

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch('/api/admin/auth/logout', { method: 'POST' });
    } catch {
      /* clearing the cookie below / redirect ends the session either way */
    }
    router.replace('/admin/login');
    router.refresh();
  }

  return (
    <div className={styles.shell}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}
        aria-label="Admin navigation"
      >
        <div className={styles.brand}>
          <span className={styles.logoMark}>F</span>
          <span className={styles.logoText}>Finriseo</span>
          <span className={styles.adminTag}>Admin</span>
        </div>

        <nav className={styles.nav}>
          {items.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href);

            if (!item.ready) {
              return (
                <span
                  key={item.href}
                  className={`${styles.navItem} ${styles.navItemDisabled}`}
                  aria-disabled="true"
                  title="Coming soon"
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{item.label}</span>
                  <span className={styles.soon}>soon</span>
                </span>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.menuBtn}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className={styles.topbarSpacer} />

          <div className={styles.userBox}>
            <div className={styles.userText}>
              <span className={styles.userName}>{admin.name}</span>
              <span className={styles.userRole}>{ROLE_LABEL[admin.role]}</span>
            </div>
            <span className={styles.avatar} aria-hidden="true">
              {admin.name.charAt(0).toUpperCase()}
            </span>
            <button
              type="button"
              className={styles.logoutBtn}
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <main id="main-content" className={styles.content}>
          {children}
        </main>
      </div>
    </div>
  );
}
