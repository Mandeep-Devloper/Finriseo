'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
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

export function ApplyLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Find current step index. If not found (e.g. edge cases), default to 0
  const currentIndex = STEPS.findIndex(step => pathname === step.path);
  const currentStepIndex = currentIndex !== -1 ? currentIndex : 0;

  return (
    <div className={styles.applyContainer}>
      
      {/* Left Panel - Hidden on Mobile */}
      <aside className={styles.leftPanel}>
        <div className={styles.leftContent}>
          <Link href="/" className={styles.logo}>
            Finriseo
          </Link>
          
          <h1 className={styles.heroTitle}>
            Instant loans upto <br/>
            <span className={styles.highlight}>₹5,00,000</span>
          </h1>

          <div className={styles.badge}>
            <ShieldCheck size={20} className={styles.badgeIcon} />
            <span>RBI Registered NBFC</span>
          </div>

          <ul className={styles.featuresList}>
            {FEATURES.map((feature, idx) => (
              <li key={idx} className={styles.featureItem}>
                <CheckCircle2 size={20} className={styles.checkIcon} />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className={styles.leftFooter}>
          <p>© {new Date().getFullYear()} Finriseo. All rights reserved.</p>
        </div>
      </aside>

      {/* Right Panel - Form Area */}
      <main id="main-content" className={styles.rightPanel}>
        <div className={styles.rightContent}>
          
          {/* Progress Bar Component — Desktop only */}
          <div className={styles.progressContainer}>
            <nav aria-label="Application progress" className={styles.progressBar}>
              {STEPS.map((step, idx) => {
                const isCompleted = idx < currentStepIndex;
                const isActive = idx === currentStepIndex;
                const isLast = idx === STEPS.length - 1;
                
                return (
                  <div key={idx} className={`${styles.step} ${isLast ? styles.stepNoFlex : ''}`}>
                    <div className={styles.stepCenter}>
                      <div className={`${styles.stepDot} ${isActive ? styles.stepDotActive : ''} ${isCompleted ? styles.stepDotDone : ''}`}>
                        {isCompleted ? <CheckCircle2 size={14} /> : (idx + 1)}
                      </div>
                      <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''} ${isCompleted ? styles.stepLabelDone : ''}`}>
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div className={`${styles.stepLine} ${isCompleted ? styles.stepLineDone : ''}`} />
                    )}
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Dynamic Route Content */}
          <div className={styles.formArea}>
            {children}
          </div>

        </div>
      </main>
    </div>
  );
}

