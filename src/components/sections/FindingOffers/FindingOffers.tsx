'use client';

// Full-screen, white "processing" interstitial shown on the offers page while the
// real offers match (POST /api/application/offers) runs.
//
// The four rows animate SEQUENTIALLY: each step moves pending → active (spinning
// ring) → done (mint circle + tick). Steps 1–3 (already-complete funnel steps)
// advance on a fixed cadence; the final row, "Comparing loan offers", keeps
// spinning until offers ACTUALLY return — it never ticks before the real result.
// Once all four are ticked, onComplete() hands control back so the NBFC offer
// list can render.
//
// The sequence ALWAYS plays in full (even on a fast/instant API response, and
// even with reduced-motion — the CSS just drops the spin/pop, the steps still
// resolve). Honest copy: no third-party verification happens, so rows are
// labelled as completed application steps — never "verified".

import React, { useEffect, useState } from 'react';
import { Check, ShieldCheck, AlertCircle } from 'lucide-react';
import { FinriseoLogo } from '@/components/ui/FinriseoLogo';
import styles from './FindingOffers.module.css';

interface FindingOffersProps {
  /** True once the real offers fetch has succeeded (gates the final row). */
  offersReady: boolean;
  /** Set when the fetch failed/timed out — switches to the error state. */
  error?: string;
  /** Called after all four rows have ticked, to reveal the offer list. */
  onComplete?: () => void;
  /** Re-runs the offers fetch (error state only). */
  onRetry?: () => void;
}

const STEP_LABELS = [
  'Basic details',
  'Employment details',
  'PAN details',
  'Comparing loan offers',
] as const;

const LAST = STEP_LABELS.length - 1;

const STEP_MS = 850;     // how long each row spins before it ticks
const COMPLETE_MS = 700; // "Your offers are ready" beat before revealing the list

type RowStatus = 'pending' | 'active' | 'done';

export function FindingOffers({ offersReady, error, onComplete, onRetry }: FindingOffersProps) {
  const isError = Boolean(error);
  const [active, setActive] = useState(0); // index of the row currently spinning
  const [allDone, setAllDone] = useState(false);

  // Drive the sequence. Steps 1–3 advance on a timer; the final step waits for
  // the real offers result, then ticks. Always plays in full.
  useEffect(() => {
    if (isError || allDone) return;

    if (active < LAST) {
      const t = setTimeout(() => setActive((a) => Math.min(a + 1, LAST)), STEP_MS);
      return () => clearTimeout(t);
    }

    // Final row: keep spinning until offers are in, then give it the same dwell
    // as the others before ticking, so all four feel consistent.
    if (active === LAST && offersReady) {
      const t = setTimeout(() => setAllDone(true), STEP_MS);
      return () => clearTimeout(t);
    }
  }, [active, offersReady, allDone, isError]);

  // Once every row is ticked, hand back to the parent to reveal the list.
  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => onComplete?.(), COMPLETE_MS);
    return () => clearTimeout(t);
  }, [allDone, onComplete]);

  const rowStatus = (i: number): RowStatus => {
    if (allDone || i < active) return 'done';
    if (i === active) return 'active';
    return 'pending';
  };

  const headline = isError
    ? "We couldn't load your offers"
    : allDone
      ? 'Your offers are ready'
      : 'Finding your best loan offers';

  const liveLabel = isError
    ? error || "We couldn't load your offers right now."
    : allDone
      ? 'Your offers are ready.'
      : `Step ${Math.min(active + 1, STEP_LABELS.length)} of ${STEP_LABELS.length}: ${STEP_LABELS[Math.min(active, LAST)]}.`;

  return (
    <div
      className={styles.screen}
      role="status"
      aria-live="polite"
      aria-busy={!isError && !allDone}
      aria-label={liveLabel}
    >
      <div className={styles.inner}>
        <FinriseoLogo className={styles.logo} aria-hidden="true" />

        <h1 className={styles.headline}>{headline}</h1>

        {!isError && (
          <p className={styles.subline}>
            <ShieldCheck size={16} className={styles.shieldIcon} aria-hidden="true" />
            No impact on your CIBIL score
          </p>
        )}

        {isError ? (
          <div className={styles.errorBlock}>
            <AlertCircle size={40} className={styles.errorIcon} aria-hidden="true" />
            <p className={styles.errorText}>
              {error || "We couldn't load your offers right now."}
            </p>
            {onRetry && (
              <button type="button" className={`btn btn--cta ${styles.retryBtn}`} onClick={onRetry}>
                Try again
              </button>
            )}
          </div>
        ) : (
          <ul className={styles.list}>
            {STEP_LABELS.map((label, i) => {
              const status = rowStatus(i);
              return (
                <li key={label} className={`${styles.row} ${styles[`row_${status}`]}`}>
                  <span className={`${styles.icon} ${styles[`icon_${status}`]}`} aria-hidden="true">
                    {status === 'done' ? (
                      <Check size={15} strokeWidth={3.5} className={styles.checkPop} />
                    ) : status === 'active' ? (
                      // Ring that spins continuously (never stuck); when the row
                      // completes it becomes a full mint circle + tick.
                      <svg className={styles.ring} viewBox="0 0 36 36">
                        <circle className={styles.ringTrack} cx="18" cy="18" r="16" />
                        <circle className={styles.ringArc} cx="18" cy="18" r="16" />
                      </svg>
                    ) : null}
                  </span>
                  <span className={styles.label}>{label}</span>
                </li>
              );
            })}
          </ul>
        )}

        {!isError && (
          <p className={styles.reassurance}>Your application is being processed securely</p>
        )}
      </div>
    </div>
  );
}
