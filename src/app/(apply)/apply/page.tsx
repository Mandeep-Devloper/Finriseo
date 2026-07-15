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
import { sendFirebaseOtp, firebaseOtpError, OTP_DEV_BYPASS, OTP_DEV_BYPASS_CODE } from '@/lib/services/firebaseOtp';
import { MAX_LOAN_DISPLAY } from '@/lib/constants';
import { trackEvent, EVENTS } from '@/lib/analytics';
import styles from './page.module.css';

export default function BasicInfoStep() {
  const router = useRouter();
  const { showToast } = useToast();
  const updateData = useApplicationStore((state) => state.updateData);
  const resetData = useApplicationStore((state) => state.resetData);
  const applicationData = useApplicationStore((state) => state);

  // Fresh-start guard: the success page no longer auto-wipes the store on a
  // timer (so its confirmation survives refreshes) — instead, arriving back at
  // step 1 with a COMPLETED application clears it, so the old referenceId can
  // never be resumed into (and overwritten by) a new journey.
  useEffect(() => {
    if (applicationData.submitted) resetData();
  }, [applicationData.submitted, resetData]);

  // Always start on 'form' so the first client render matches the server HTML:
  // the store restores from sessionStorage on the client only, so deriving the
  // step here would hydrate 'otp' against server-rendered 'form' (hydration
  // error). The mobile/otpVerified effect below moves to 'otp' after mount.
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [currentMobile, setCurrentMobile] = useState<string>(applicationData.mobile || '');
  const [otpError, setOtpError] = useState<string>('');
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(60);
  const [otpValue, setOtpValue] = useState('');
  // T&C/credit-bureau consent is mandatory and shown as a DISCLOSURE (the
  // affirmative act is pressing Continue with it adjacent) — a locked, pre-ticked
  // checkbox only simulates a choice and confuses screen readers. The WhatsApp
  // opt-in, by contrast, is a REAL choice the user can untick; it defaults on
  // (service updates about their own application) and is persisted server-side.
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);

  const hasAutoSent = React.useRef(false);
  // Holds the in-flight Firebase Phone Auth session used to confirm the code.
  const confirmationRef = React.useRef<ConfirmationResult | null>(null);

  // When the journey is opened in a fresh browser tab from the landing hero,
  // name + mobile arrive as query params (a new tab doesn't inherit the opener
  // tab's in-memory store). Hydrate the store once, then strip the params from
  // the URL so the phone number doesn't linger in the address bar / history.
  const hydratedFromQuery = React.useRef(false);
  useEffect(() => {
    if (hydratedFromQuery.current) return;
    hydratedFromQuery.current = true;
    // Top of the funnel — without this event the GA funnel had no entry step,
    // so hero→OTP conversion was unmeasurable.
    trackEvent(EVENTS.APPLY_START);
    const sp = new URLSearchParams(window.location.search);
    const qMobile = sp.get('mobile') ?? '';
    const qName = sp.get('name') ?? '';
    if (/^[6-9]\d{9}$/.test(qMobile) && !applicationData.mobile) {
      updateData({ fullName: qName, mobile: qMobile });
      window.history.replaceState(null, '', '/apply');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (applicationData.mobile && !applicationData.otpVerified && !hasAutoSent.current) {
      hasAutoSent.current = true;
      setStep('otp');
      // Only auto-send once per mobile per browser session. A page reload loses
      // the in-memory confirmation but must NOT silently fire another (paid) SMS;
      // in that case we show the OTP step with Resend available immediately.
      const sentKey = `otp-auto-sent:${applicationData.mobile}`;
      if (sessionStorage.getItem(sentKey)) {
        setTimer(0);
        return;
      }
      sessionStorage.setItem(sentKey, '1');
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
    trackEvent(EVENTS.OTP_SENT);
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
    trackEvent(EVENTS.OTP_VERIFIED);
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
        // The mandatory consent disclosure was accepted by proceeding; record it.
        consent: true,
        // The user's actual WhatsApp choice at the moment of verification.
        whatsappOptIn,
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
    trackEvent(EVENTS.OTP_SENT, { resend: true });
    showToast('OTP resent successfully', 'success');
  };

  return (
    <div className={styles.container}>
      {/* Invisible reCAPTCHA target required by Firebase Phone Auth. */}
      <div id="recaptcha-container" />

      <div className={styles.header}>
        <h2 className={styles.title}>
          {step === 'form' ? 'Get personalized Loan Offers' : 'OTP Verification'}
        </h2>
        <p className={styles.subtitle}>
          {step === 'form'
            ? `Get a Loan up to ${MAX_LOAN_DISPLAY} in Minutes.`
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

          <div className={styles.ctaGroup}>
            <button
              type="submit"
              className={`btn btn--cta btn--lg ${styles.submitBtn} ${isLoading ? 'btn--disabled' : ''}`}
              disabled={isLoading}
            >
              {isLoading ? <><Loader2 size={18} className="spin" /> Sending...</> : 'Check Eligibility'}
            </button>

            <p className={styles.cibilNote}>No impact on your CIBIL score</p>
          </div>
        </form>
      )}

      {step === 'otp' && (
        <div className={styles.form}>
          {/* Compile-time false in production builds — dev reminder only. */}
          {OTP_DEV_BYPASS && (
            <p className={styles.cibilNote} style={{ color: 'var(--gold-600)' }}>
              Dev bypass on — no SMS sent. Enter {OTP_DEV_BYPASS_CODE}.
            </p>
          )}
          <div className={styles.otpWrapper}>
            <OtpInput
              length={6}
              onComplete={setOtpValue}
              onChange={setOtpValue}
              error={otpError}
              disabled={isLoading}
            />
          </div>

          {/* Surface send failures (e.g. auto-send on arrival from the landing
              page) here too — otherwise the OTP screen looks silently broken. */}
          {apiError && <p className={styles.errorText} role="alert">{apiError}</p>}

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

          <div className={styles.bottomGroup}>
          {/* Mandatory consent as a DISCLOSURE, not a fake checkbox: pressing
              "Continue to Verify" with this adjacent is the affirmative act,
              and the server records it (timestamp/version/IP/UA). */}
          <div className={styles.consentBox}>
            <p className={styles.consentText}>
              By proceeding, you agree to our <Link href="/terms" className={styles.link}>Terms &amp; Conditions</Link> and <Link href="/privacy-policy" className={styles.link}>Privacy Policy</Link>, and consent to us accessing your credit information from credit bureaus for processing your application.
            </p>
          </div>

          {/* Genuine optional opt-in — the user can untick it. */}
          <div className={styles.consentBox}>
            <input
              type="checkbox"
              id="consentWhatsapp"
              className={styles.checkbox}
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              disabled={isLoading}
            />
            <label htmlFor="consentWhatsapp" className={styles.consentText}>
              Send me loan-related updates, alerts, and communications via WhatsApp on my registered mobile number. (Optional)
            </label>
          </div>

          <button
            type="button"
            onClick={() => handleVerifyOtp(otpValue)}
            className={`btn btn--cta btn--lg ${styles.submitBtn} ${(isLoading || otpValue.length !== 6) ? 'btn--disabled' : ''}`}
            disabled={isLoading || otpValue.length !== 6}
          >
            {isLoading ? <><Loader2 size={18} className="spin" /> Verifying...</> : 'Continue to Verify'}
          </button>
          </div>
        </div>
      )}

      {/* Required reCAPTCHA attribution: the floating badge is hidden via CSS
          (.grecaptcha-badge in globals.css), which Google permits only if this
          notice is shown in the flow instead. Do not remove one without the other. */}
      <p className={styles.recaptchaNotice}>
        This site is protected by reCAPTCHA and the Google{' '}
        <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and{' '}
        <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a> apply.
      </p>
    </div>
  );
}
