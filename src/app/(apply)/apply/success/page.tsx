'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CheckCircle, Copy, Home, Phone, IndianRupee, Percent, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useApplicationStore } from '@/store/applicationStore';
import { COMPANY } from '@/lib/constants';
import { formatINR } from '@/lib/financial';
import { useToast } from '@/components/ui/Toast';
import { trackEvent, EVENTS } from '@/lib/analytics';
import { applicationService } from '@/lib/services';
import styles from './page.module.css';

export default function SuccessStep() {
  const router = useRouter();
  const { showToast } = useToast();
  const applicationData = useApplicationStore((state) => state);
  const updateData = useApplicationStore((state) => state.updateData);
  const resetData = useApplicationStore((state) => state.resetData);
  
  const [mounted, setMounted] = useState(false);
  const [apiStatus, setApiStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [savedOffer, setSavedOffer] = useState<typeof applicationData.selectedOffer>(null);
  const [savedRef, setSavedRef] = useState<string>('');
  const hasInitialized = React.useRef(false);

  useEffect(() => {
    // Prevent re-running after resetData() clears the store
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    setMounted(true);

    if (!applicationData.selectedOffer) {
      router.replace('/apply');
      return;
    }

    // Snapshot values before any async work or store resets
    const offer = applicationData.selectedOffer;
    const refId = applicationData.referenceId;
    const appData = { ...applicationData };

    // Only skip re-submitting if the final submit already succeeded before
    // (e.g. user refreshed this page). A referenceId alone isn't enough —
    // it now exists as soon as OTP is verified (draft application).
    if (applicationData.submitted && refId) {
      setSavedRef(refId);
      setSavedOffer(offer);
      setApiStatus('success');
      setTimeout(() => resetData(), 2000);
      return;
    }

    const submit = async () => {
      setApiStatus('loading');

      const { data, error } = await applicationService.submitApplication({
        referenceId: appData.referenceId,
        mobile: appData.mobile,
        fullName: appData.fullName,
        email: appData.email,
        pinCode: appData.pinCode,
        employmentType: appData.employmentType,
        monthlyIncome: appData.monthlyIncome,
        salaryMode: appData.salaryMode,
        employer: appData.employer,
        experience: appData.experience,
        loanAmount: appData.loanAmount,
        loanPurpose: appData.loanPurpose,
        panNumber: appData.panNumber,
        selectedOffer: offer,
      });

      if (error || !data?.referenceId) {
        setApiStatus('error');
        setErrorMessage(error ?? 'Submission failed. Please try again.');
        return;
      }

      updateData({ referenceId: data.referenceId, submitted: true });
      setSavedRef(data.referenceId);
      setSavedOffer(offer);
      trackEvent(EVENTS.APPLICATION_COMPLETE);
      setApiStatus('success');
      setTimeout(() => resetData(), 2000);
    };

    submit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prevent hydration flash
  if (!mounted || apiStatus === 'loading') {
    return (
      <div className={styles.container} style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spin" style={{ width: 24, height: 24, border: '2px solid var(--primary-600)', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ color: 'var(--gray-600)' }}>Submitting application...</p>
        </div>
      </div>
    );
  }

  if (apiStatus === 'error') {
    return (
      <div className={styles.errorBox}>
        <h2 className={styles.errorTitle}>Submission Failed</h2>
        <p className={styles.errorText}>{errorMessage}</p>
        <p className={styles.errorContact}>
          Please call us at {COMPANY.phone} or email 
          support@finriseo.com with your details.
        </p>
        <div className={styles.errorActions}>
          <button 
            className={styles.retryBtn}
            onClick={() => {
              setApiStatus('loading');
              setErrorMessage('');
              // Re-trigger submit logic next render or just reload
              window.location.reload();
            }}
          >
            Retry Submission
          </button>
          <Link href="/" className={styles.homeBtn}>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(savedRef);
    showToast('Reference ID copied to clipboard', 'success');
  };

  return (
    <div className={styles.container}>
      <div className={styles.successHeader}>
        <motion.div 
          className={styles.iconWrapper}
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <CheckCircle className={styles.checkIcon} />
        </motion.div>
        <h2 className={styles.title}>Application Submitted!</h2>
        <p className={styles.subtitle}>
          Your loan application has been successfully submitted to {savedOffer?.lender}.
        </p>
      </div>

      <div className={styles.refBox}>
        <span className={styles.refLabel}>Application Reference ID</span>
        <div className={styles.refCodeWrapper}>
          <code className={styles.refCode}>{savedRef}</code>
          <button onClick={handleCopy} className={styles.copyBtn} aria-label="Copy Reference ID">
            <Copy size={16} />
          </button>
        </div>
      </div>

      {savedOffer && (
        <div className={styles.summaryCard}>
          <div className={styles.cardHeader}>
            <div className={styles.lenderAvatar} style={{ backgroundColor: savedOffer.color }}>
              {savedOffer.lender.charAt(0)}
            </div>
            <h3 className={styles.lenderName}>{savedOffer.lender}</h3>
          </div>
          <div className={styles.statsGrid}>
            <div className={styles.stat}>
              <Percent size={14} className={styles.statIcon} />
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Rate</span>
                <span className={styles.statValue}>{savedOffer.rateDisplay}</span>
              </div>
            </div>
            <div className={styles.stat}>
              <IndianRupee size={14} className={styles.statIcon} />
              <div className={styles.statContent}>
                <span className={styles.statLabel}>EMI</span>
                <span className={styles.statValue}>{formatINR(savedOffer.emi)}</span>
              </div>
            </div>
            <div className={styles.stat}>
              <Calendar size={14} className={styles.statIcon} />
              <div className={styles.statContent}>
                <span className={styles.statLabel}>Tenure</span>
                <span className={styles.statValue}>{savedOffer.tenureDisplay}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={styles.nextStepsSection}>
        <h3 className={styles.sectionTitle}>What happens next?</h3>
        <div className={styles.timeline}>
          <div className={styles.timelineStep}>
            <div className={styles.stepMarker}>1</div>
            <p className={styles.stepText}>Our team will review your application within 10 minutes</p>
          </div>
          <div className={styles.timelineStep}>
            <div className={styles.stepMarker}>2</div>
            <p className={styles.stepText}>Selected NBFC partner will contact you for document verification</p>
          </div>
          <div className={styles.timelineStep}>
            <div className={styles.stepMarker}>3</div>
            <p className={styles.stepText}>Post approval, loan amount will be credited to your bank account</p>
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <div className={styles.tooltipWrapper}>
          <button type="button" className={`btn btn--ghost ${styles.trackBtn}`} disabled>
            Track Application
          </button>
          <span className={styles.tooltip}>Coming Soon</span>
        </div>
        <button 
          type="button" 
          onClick={() => router.push('/')}
          className="btn btn--cta"
        >
          <Home size={16} />
          Back to Home
        </button>
      </div>

      <div className={styles.supportNote}>
        <Phone size={14} className={styles.supportIcon} />
        <span>Questions? Call us at <strong>{COMPANY.phone}</strong> | {COMPANY.workingHours}</span>
      </div>
    </div>
  );
}
