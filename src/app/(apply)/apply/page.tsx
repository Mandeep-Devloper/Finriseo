'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step1Schema, Step1FormData } from '@/lib/validations';
import type { ConfirmationResult } from 'firebase/auth';
import { OtpInput } from '@/components/ui/OtpInput';
import { useToast } from '@/components/ui/Toast';
import { otpService, applicationService } from '@/lib/services';
import { sendFirebaseOtp, firebaseOtpError } from '@/lib/services/firebaseOtp';
import styles from './page.module.css';

export default function BasicInfoStep() {
  const router = useRouter();
  const { showToast } = useToast();
  const updateData = useApplicationStore((state) => state.updateData);
  const applicationData = useApplicationStore((state) => state);

  const [step, setStep] = useState<'form' | 'otp'>(
    (applicationData.mobile && !applicationData.otpVerified) ? 'otp' : 'form'
  );
  const [currentMobile, setCurrentMobile] = useState<string>(applicationData.mobile || '');
  const [otpError, setOtpError] = useState<string>('');
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [otpValue, setOtpValue] = useState('');
  const [consentTerms, setConsentTerms] = useState(true);
  const [consentWhatsapp, setConsentWhatsapp] = useState(true);
  
  const hasAutoSent = React.useRef(false);
  // Holds the in-flight Firebase Phone Auth session used to confirm the code.
  const confirmationRef = React.useRef<ConfirmationResult | null>(null);

  useEffect(() => {
    if (applicationData.mobile && !applicationData.otpVerified && !hasAutoSent.current) {
      hasAutoSent.current = true;
      setStep('otp');
      handleSendOtp({ fullName: applicationData.fullName || '', mobile: applicationData.mobile, consent: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationData.mobile, applicationData.otpVerified, applicationData.fullName]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp') {
      interval = setInterval(() => {
        setTimer((prev) => prev > 0 ? prev - 1 : 0);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fullName: applicationData.fullName || '',
      mobile: applicationData.mobile || '',
      consent: true,
    }
  });

  const handleSendOtp = async (values: Step1FormData) => {
    setIsLoading(true);
    setApiError('');
    try {
      confirmationRef.current = await sendFirebaseOtp(values.mobile);
    } catch (err) {
      setIsLoading(false);
      setApiError(firebaseOtpError(err));
      return;
    }
    setIsLoading(false);
    updateData({ fullName: values.fullName });
    setCurrentMobile(values.mobile);
    setStep('otp');
    setTimer(60);
  };

  const handleVerifyOtp = async (otp: string) => {
    setIsLoading(true);
    setOtpError('');

    if (!confirmationRef.current) {
      setIsLoading(false);
      setOtpError('Session expired. Please resend the OTP.');
      return;
    }

    // Confirm the code with Firebase, then exchange the signed-in user for an
    // ID token our server can verify.
    let idToken: string;
    try {
      const credential = await confirmationRef.current.confirm(otp);
      idToken = await credential.user.getIdToken();
    } catch (err) {
      setIsLoading(false);
      setOtpError(firebaseOtpError(err));
      return;
    }

    const { error } = await otpService.verifyToken(currentMobile, idToken);
    if (error) { setIsLoading(false); setOtpError(error); return; }

    // OTP is verified — mark the store and move to the next step immediately.
    // We deliberately do NOT block navigation on the draft-row write below: a
    // cold DB connection can take several seconds, and the user shouldn't wait
    // for it just to see the next form.
    setIsLoading(false);
    updateData({ mobile: currentMobile, otpVerified: true });
    router.push('/apply/basic-details');

    // Create the draft Application row in the background so the lead is visible
    // in the database from this step on. The referenceId lands in the store
    // when it resolves; the next step's save reads it from there (and safely
    // no-ops if the user submits before it arrives).
    applicationService
      .startApplication({
        mobile: currentMobile,
        fullName: applicationData.fullName || '',
        referenceId: applicationData.referenceId || undefined,
      })
      .then(({ data: started }) => {
        if (started?.referenceId) updateData({ referenceId: started.referenceId });
      });
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setOtpError('');
    try {
      confirmationRef.current = await sendFirebaseOtp(currentMobile);
    } catch (err) {
      setOtpError(firebaseOtpError(err));
      return;
    }
    setTimer(60);
    showToast('OTP resent successfully', 'success');
  };

  return (
    <div className={styles.container}>
      {/* Invisible reCAPTCHA target required by Firebase Phone Auth. */}
      <div id="recaptcha-container" />

      {/* Mobile image slot — shown on form step only; hidden on desktop */}
      {step === 'form' && (
        <div className={styles.mobileImageSlot}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/firststep.svg" alt="" className={styles.slotImage} />
        </div>
      )}

      <div className={styles.header}>
        <h2 className={styles.title}>
          {step === 'form' ? 'Get personalized Loan Offers' : 'OTP Verification'}
        </h2>
        <p className={styles.subtitle}>
          {step === 'form'
            ? 'Get a Loan up to ₹50,00,000 in Minutes.'
            : <>Please enter the 6-digit OTP sent to{' '}<span className={styles.mobileHighlight}>+91&nbsp;{currentMobile}</span>
                <button
                  type="button"
                  onClick={() => setStep('form')}
                  className={styles.editMobileBtn}
                  disabled={isLoading}
                  aria-label="Change mobile number"
                >
                  <Pencil size={14} />
                </button>
              </>}
        </p>
      </div>

      {step === 'form' && (
        <form onSubmit={handleSubmit(handleSendOtp)} className={styles.form}>
          {/* Full Name */}
          <div className={styles.inputGroup}>
            <label htmlFor="fullName" className={styles.label}>Full Name</label>
            <input
              id="fullName"
              type="text"
              placeholder="Enter your full name"
              className={`${styles.input} ${styles.inputNormal} ${errors.fullName ? styles.inputError : ''}`}
              {...register('fullName')}
            />
            {errors.fullName && <p className={styles.errorText}>{errors.fullName.message}</p>}
          </div>

          {/* Mobile Number */}
          <div className={styles.inputGroup}>
            <label htmlFor="mobile" className={styles.label}>Mobile Number</label>
            <div className={styles.mobileInputWrapper}>
              <div className={styles.prefixWrapper}>
                <span className={styles.flag}>🇮🇳</span>
                <span className={styles.prefixText}>+91</span>
              </div>
              <input
                id="mobile"
                type="tel"
                placeholder="Enter 10-digit mobile number"
                maxLength={10}
                className={`${styles.input} ${styles.inputNormal} ${errors.mobile ? styles.inputError : ''}`}
                {...register('mobile')}
              />
            </div>
            {errors.mobile && <p className={styles.errorText}>{errors.mobile.message}</p>}
            {apiError && <p className={styles.errorText} role="alert">{apiError}</p>}
          </div>

          <button
            type="submit"
            className={`btn btn--cta btn--lg ${styles.submitBtn} ${isLoading ? 'btn--disabled' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? <><Loader2 size={18} className="spin" /> Sending...</> : 'Check Eligibility'}
          </button>

          <p className={styles.cibilNote}>No impact on your CIBIL score</p>
        </form>
      )}

      {step === 'otp' && (
        <div className={styles.form}>
          <div className={styles.otpWrapper}>
            <OtpInput
              length={6}
              onComplete={setOtpValue}
              onChange={setOtpValue}
              error={otpError}
              disabled={isLoading}
            />
          </div>

          <div className={styles.otpActions}>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={timer > 0 || isLoading}
              className={`${styles.resendBtn} ${timer > 0 ? styles.disabled : ''}`}
              aria-label="Resend OTP"
            >
              {timer > 0 ? `Resend in ${timer} seconds` : 'Resend OTP'}
            </button>
          </div>

          <div className={styles.consentBox}>
            <input
              type="checkbox"
              id="consentTerms"
              className={styles.checkbox}
              checked={consentTerms}
              onChange={(e) => setConsentTerms(e.target.checked)}
            />
            <label htmlFor="consentTerms" className={styles.consentText}>
              By proceeding, you agree to our <Link href="/terms" className={styles.link}>Terms &amp; Conditions</Link> and <Link href="/privacy-policy" className={styles.link}>Privacy Policy</Link>, and consent to us accessing your credit information from credit bureaus for processing your application.
            </label>
          </div>

          <div className={styles.consentBox}>
            <input
              type="checkbox"
              id="consentWhatsapp"
              className={styles.checkbox}
              checked={consentWhatsapp}
              onChange={(e) => setConsentWhatsapp(e.target.checked)}
            />
            <label htmlFor="consentWhatsapp" className={styles.consentText}>
              I consent to receive loan-related updates, alerts, and communications via WhatsApp on my registered mobile number.
            </label>
          </div>

          <button
            type="button"
            onClick={() => handleVerifyOtp(otpValue)}
            className={`btn btn--cta btn--lg ${styles.submitBtn} ${(isLoading || otpValue.length !== 6 || !consentTerms) ? 'btn--disabled' : ''}`}
            disabled={isLoading || otpValue.length !== 6 || !consentTerms}
          >
            {isLoading ? <><Loader2 size={18} className="spin" /> Verifying...</> : 'Continue to Verify'}
          </button>
        </div>
      )}
    </div>
  );
}
