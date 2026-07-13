'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { FinriseoLogo } from '@/components/ui/FinriseoLogo';
import { MAX_LOAN_DISPLAY } from '@/lib/constants';
import styles from './ApplyLayout.module.css';

const STEPS = [
  { label: "Basic Info", path: "/apply" },
  { label: "Details", path: "/apply/basic-details" },
  { label: "Employment", path: "/apply/employment" },
  { label: "PAN", path: "/apply/pan" },
  { label: "Offers", path: "/apply/offers" },
  { label: "Done", path: "/apply/success" }
];

const FEATURES = [
  "10 mins approval",
  "Options for extension",
  "Timely rewards",
  "Direct bank transfer",
  "Flexible repayment",
  "Minimal documentation"
];

// Claims already used elsewhere on the site (About page / home metadata).
const STATS = [
  { value: '2,00,000+', label: 'Happy Customers' },
  { value: '50+', label: 'NBFC Partners' },
  { value: '100%', label: 'Digital Process' },
];

export function ApplyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Find current step index. If not found (e.g. edge cases), default to 0
  const currentIndex = STEPS.findIndex(step => pathname === step.path);
  const currentStepIndex = currentIndex !== -1 ? currentIndex : 0;
  const progressPct = ((currentStepIndex + 1) / STEPS.length) * 100;

  return (
    <div className={styles.applyContainer}>

      {/* Decorative brand backdrop — tablet/desktop only */}
      <div className={styles.bgDecor} aria-hidden="true">
        <div className={styles.orbGreen} />
        <div className={styles.orbGold} />
        <div className={styles.ringTop} />
        <div className={styles.ringGold} />
      </div>

      {/* Left branding panel — desktop only. The logo is deliberately NOT a
          link: once a user enters the journey there is no way back to the
          landing page from here — the only path is the form itself. */}
      <aside className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <div className={styles.logo} aria-label="Finriseo">
            <FinriseoLogo style={{ width: '158px', height: '33px' }} />
            <span className={styles.tagline}>One application, multiple offers</span>
          </div>

          <h1 className={styles.heroTitle}>
            Instant loans<br />
            up to{' '}
            <span className={styles.highlight}>
              {MAX_LOAN_DISPLAY}
              {/* Hand-drawn gold ellipse around the amount */}
              <svg
                className={styles.circleSvg}
                viewBox="0 0 240 84"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <ellipse
                  cx="120" cy="42" rx="112" ry="34"
                  fill="none"
                  stroke="var(--gold-400)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="420 60"
                  transform="rotate(-2 120 42)"
                />
              </svg>
            </span>
          </h1>

          <div className={styles.badge}>
            <ShieldCheck size={20} className={styles.badgeIcon} />
            <span>RBI Registered NBFC Partners</span>
          </div>

          <div className={styles.statsRow}>
            {STATS.map((stat) => (
              <div key={stat.label} className={styles.statItem}>
                <span className={styles.statValue}>{stat.value}</span>
                <span className={styles.statLabel}>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.featuresBox}>
            <ul className={styles.featuresList}>
              {FEATURES.map((feature, idx) => (
                <li key={idx} className={styles.featureItem}>
                  <CheckCircle2 size={18} className={styles.checkIcon} />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className={styles.leftFooter}>
          <p>© {new Date().getFullYear()} Finriseo. All rights reserved.</p>
        </div>
      </aside>

      {/* Form area — a phone-style frame floating on the brand backdrop on
          tablet/desktop; a full-bleed app screen on mobile. The journey pages
          render unchanged inside it. */}
      <main id="main-content" className={styles.rightPanel}>
        <div className={styles.phoneCard}>
          <div className={styles.cardProgress} aria-hidden="true">
            <div
              className={styles.cardProgressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className={styles.formArea}>
            {children}
          </div>

          <div className={styles.homeIndicator} aria-hidden="true" />
        </div>
      </main>
    </div>
  );
}
