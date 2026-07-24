'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Rocket, Clock, ArrowRight } from 'lucide-react';
import { motivationalMessage } from '@/lib/application/progress';
import styles from './ResumeJourneyCard.module.css';

interface ResumeSummary {
  hasDraft: boolean;
  progressPct?: number;
  currentRoute?: string;
  lastActivityAt?: string;
  estRemainingMin?: number;
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const day = 24 * 60 * 60 * 1000;
  if (diffMs < 60 * 1000) return 'Just now';
  if (diffMs < 60 * 60 * 1000) return `${Math.round(diffMs / (60 * 1000))} min ago`;
  if (diffMs < day) return 'Today';
  if (diffMs < 2 * day) return 'Yesterday';
  return `${Math.round(diffMs / day)} days ago`;
}

export function ResumeJourneyCard({ onHasDraft }: { onHasDraft?: (has: boolean) => void }) {
  const [summary, setSummary] = useState<ResumeSummary | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/application/resume', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((data: ResumeSummary) => {
        if (!alive) return;
        setSummary(data);
        onHasDraft?.(Boolean(data.hasDraft));
      })
      .catch(() => { if (alive) onHasDraft?.(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!summary?.hasDraft) return null;

  const pct = summary.progressPct ?? 0;

  return (
    <motion.div
      className={styles.card}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className={styles.headerRow}>
        <span className={styles.badge}>
          <Rocket size={16} className={styles.badgeIcon} /> Continue Your Loan Journey
        </span>
        <span className={styles.lastActivity}>{relativeTime(summary.lastActivityAt)}</span>
      </div>

      <div className={styles.figureRow}>
        <span className={styles.figure}>
          <span className={styles.pct}>{pct}%</span>
          <span className={styles.pctLabel}>completed</span>
        </span>
        {summary.estRemainingMin ? (
          <span className={styles.eta}><Clock size={13} /> ~{summary.estRemainingMin} min left</span>
        ) : null}
      </div>

      <div
        className={styles.progressTrack}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Application progress"
      >
        <motion.div
          className={styles.progressFill}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeInOut' }}
        />
      </div>

      <p className={styles.message}>{motivationalMessage(pct)}</p>

      <Link href={summary.currentRoute ?? '/apply/basic-details'} className={styles.cta}>
        Continue Application <ArrowRight size={18} className={styles.ctaArrow} />
      </Link>
    </motion.div>
  );
}
