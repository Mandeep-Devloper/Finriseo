'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle, Phone } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { formatINR } from '@/lib/financial';
import { trackEvent, EVENTS } from '@/lib/analytics';
import { applicationService } from '@/lib/services';
import type { LoanOffer } from '@/types/application';
import styles from './page.module.css';

export default function OffersStep() {
  const router = useRouter();
  const updateData = useApplicationStore((state) => state.updateData);
  const applicationData = useApplicationStore((state) => state);
  const [mounted, setMounted] = useState(false);
  const [offers, setOffers] = useState<LoanOffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  useEffect(() => {
    setMounted(true);
    
    // Security Route Guard
    if (!applicationData.otpVerified) {
      router.replace('/apply');
      return;
    }

    const load = async () => {
      const { data, error } = await applicationService.fetchOffers({
        mobile: applicationData.mobile || '',
        loanAmount: Number(applicationData.loanAmount) || 300000,
        employmentType: applicationData.employmentType || '',
        monthlyIncome: Number(applicationData.monthlyIncome) || 0,
      });
      
      if (error || !data?.offers?.length) {
        setFetchError(error ?? 'No offers available. We will call you shortly.');
      } else {
        setOffers(data.offers);
        // Pre-select if arriving via back button
        if (applicationData.selectedOffer) {
          setSelectedOfferId((applicationData.selectedOffer as LoanOffer).id);
        }
      }
      setIsLoading(false);
    };
    load();
  }, [applicationData, router]);

  // Prevent flash before hydration / auth redirect
  if (!mounted || !applicationData.otpVerified) {
    return null;
  }

  const handleProceed = () => {
    if (!selectedOfferId) return;
    
    const selected = offers.find(o => o.id === selectedOfferId);
    if (selected) {
      updateData({ 
        selectedOffer: selected as unknown as import('@/types/application').LoanOffer,
      });
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
        {isLoading && (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingHeader}>
              <h3 className={styles.loadingTitle}>Finding your best loan offers</h3>
              <p className={styles.loadingSubtitle}>
                <CheckCircle size={14} className={styles.greenText} /> No impact on your CIBIL score
              </p>
            </div>
            
            <div className={styles.checklist}>
              <div className={`${styles.checklistItem} ${styles.itemDone} ${styles.delay1}`}>
                <CheckCircle size={20} className={styles.checkIconLight} />
                <span>Basic details verified</span>
              </div>
              <div className={`${styles.checklistItem} ${styles.itemDone} ${styles.delay2}`}>
                <CheckCircle size={20} className={styles.checkIconLight} />
                <span>Employment details verified</span>
              </div>
              <div className={`${styles.checklistItem} ${styles.itemDone} ${styles.delay3}`}>
                <CheckCircle size={20} className={styles.checkIconLight} />
                <span>PAN verified</span>
              </div>
              <div className={`${styles.checklistItem} ${styles.itemLoading} ${styles.delay4}`}>
                <div className={styles.spinnerCircle}></div>
                <span>Comparing loan offers...</span>
              </div>
            </div>
          </div>
        )}
        
        {fetchError && !isLoading && (
          <div className={styles.disclaimerBox} style={{ background: 'var(--error-50)', color: 'var(--error-900)', border: '1px solid var(--error-200)', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{fetchError}</p>
            <button className="btn btn--cta" onClick={() => router.push('/contact')}>
              <Phone size={16} /> Contact Support
            </button>
          </div>
        )}

        {!isLoading && !fetchError && offers.map((offer, index) => {
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
          disabled={!selectedOfferId || isLoading || !!fetchError}
          onClick={handleProceed}
        >
          Accept & Proceed
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
