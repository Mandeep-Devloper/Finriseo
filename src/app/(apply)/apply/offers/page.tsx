'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { formatINR } from '@/lib/financial';
import { trackEvent, EVENTS } from '@/lib/analytics';
import { applicationService } from '@/lib/services';
import { FindingOffers } from '@/components/sections/FindingOffers/FindingOffers';
import type { LoanOffer } from '@/types/application';
import styles from './page.module.css';

// Phases of this screen:
//   working → "Finding your best loan offers" interstitial while the real offers
//             match (POST /api/application/offers) runs
//   ready   → fetch succeeded; FindingOffers finishes its sequence, then calls
//             onComplete to reveal the list
//   list    → the selectable offer cards
//   error   → the match failed/timed out; retry re-runs the fetch only
type Phase = 'working' | 'ready' | 'list' | 'error';

export default function OffersStep() {
  const router = useRouter();
  const updateData = useApplicationStore((state) => state.updateData);
  const applicationData = useApplicationStore((state) => state);
  const [mounted, setMounted] = useState(false);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('working');
  const [fetchError, setFetchError] = useState('');
  // Bumped on every (re)run so the interstitial remounts and replays from step 1.
  const [runId, setRunId] = useState(0);
  const hasLoaded = useRef(false);

  const { mobile, loanAmount, employmentType, monthlyIncome, selectedOffer } = applicationData;

  // Runs the real offers match. The interstitial owns the animation timing; row 4
  // ("Comparing loan offers") only checks off once this actually resolves.
  const load = useCallback(async () => {
    setRunId((id) => id + 1);
    setFetchError('');
    setPhase('working');

    const { data, error } = await applicationService.fetchOffers({
      mobile: mobile || '',
      loanAmount: Number(loanAmount) || 300000,
      employmentType: employmentType || '',
      monthlyIncome: Number(monthlyIncome) || 0,
    });

    if (error || !data?.offers?.length) {
      setFetchError(error ?? 'No offers available right now. Please try again.');
      setPhase('error');
      return;
    }

    setOffers(data.offers);
    if (selectedOffer) {
      setSelectedOfferId(selectedOffer.id);
    }
    setPhase('ready'); // FindingOffers will finish, then call onComplete → 'list'
  }, [mobile, loanAmount, employmentType, monthlyIncome, selectedOffer]);

  const revealList = useCallback(() => setPhase('list'), []);

  useEffect(() => {
    setMounted(true);
    // Security route guard
    if (!applicationData.otpVerified) {
      router.replace('/apply');
      return;
    }
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    load();
  }, [applicationData.otpVerified, router, load]);

  // Prevent flash before hydration / auth redirect
  if (!mounted || !applicationData.otpVerified) {
    return null;
  }

  // Full-screen interstitial for everything that isn't the final list.
  if (phase !== 'list') {
    return (
      <FindingOffers
        key={runId}
        offersReady={phase === 'ready'}
        error={phase === 'error' ? fetchError : undefined}
        onComplete={revealList}
        onRetry={load}
      />
    );
  }

  const handleProceed = () => {
    if (!selectedOfferId) return;

    const selected = offers.find((o) => o.id === selectedOfferId);
    if (selected) {
      updateData({ selectedOffer: selected });
      trackEvent(EVENTS.OFFER_SELECTED, { lender: selected.lender, rate: selected.rate });
      router.push('/apply/success');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Your Pre-Qualified Offers</h2>
        <p className={styles.subtitle}>
          Based on your profile, here are the best offers available. Select one to proceed.
        </p>
      </div>

      <div className={styles.offersGrid}>
        {offers.map((offer, index) => {
          const isSelected = selectedOfferId === offer.id;

          return (
            <button
              key={offer.id}
              className={`${styles.offerCard} ${isSelected ? styles.offerCardSelected : ''}`}
              onClick={() => setSelectedOfferId(offer.id)}
              aria-pressed={isSelected}
            >
              {index === 0 && <div className={styles.recommendedBadge}>Recommended</div>}

              <div className={styles.cardHeader}>
                <div className={styles.lenderInfo}>
                  <div className={styles.lenderAvatar} style={{ backgroundColor: offer.color }}>
                    {offer.lender.charAt(0)}
                  </div>
                  <h3 className={styles.lenderName}>{offer.lender}</h3>
                </div>
                {isSelected && <CheckCircle className={styles.checkIcon} size={24} />}
              </div>

              <div className={styles.statsGrid}>
                <div className={styles.stat}>
                  <div className={styles.statLabel}>Interest Rate</div>
                  <div className={styles.statValue}>{offer.rateDisplay}</div>
                </div>

                <div className={styles.stat}>
                  <div className={styles.statLabel}>Monthly EMI</div>
                  <div className={`${styles.statValue} ${styles.emiValue}`}>{formatINR(offer.emi)}</div>
                </div>

                <div className={styles.stat}>
                  <div className={styles.statLabel}>Tenure</div>
                  <div className={styles.statValue}>{offer.tenureDisplay}</div>
                </div>

                <div className={styles.stat}>
                  <div className={styles.statLabel}>Processing Fee</div>
                  <div className={styles.statValue}>{offer.fee}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className={styles.disclaimerBox}>
        <p>
          <strong>Disclaimer:</strong> Rates shown are indicative only. Final offer, interest rate, and terms are determined by the respective lender based on your credit profile and are subject to their approval.
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          onClick={() => router.push('/apply/pan')}
          className={`btn btn--ghost ${styles.backBtn}`}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          type="button"
          className="btn btn--cta"
          disabled={!selectedOfferId}
          onClick={handleProceed}
        >
          Accept & Proceed
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
