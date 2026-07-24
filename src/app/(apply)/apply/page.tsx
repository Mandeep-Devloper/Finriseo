'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil, CheckCircle2 } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step1Schema, Step1FormData } from '@/lib/validations';
import type { ConfirmationResult } from 'firebase/auth';
import { OtpInput } from '@/components/ui/OtpInput';
import { useToast } from '@/components/ui/Toast';
import { otpService, applicationService } from '@/lib/services';
import { sendFirebaseOtp, prewarmFirebaseOtp, firebaseOtpError, OTP_DEV_BYPASS, OTP_DEV_BYPASS_CODE } from '@/lib/services/firebaseOtp';
import { MAX_LOAN_DISPLAY } from '@/lib/constants';
import { trackEvent, EVENTS } from '@/lib/analytics';
import styles from './page.module.css';

// SMS delivery status, decoupled from verification: the OTP screen shows
// instantly and the send runs in the background, so the inputs stay usable
// while this progresses idle → sending → sent (or failed → Resend enabled).
type SendState = 'idle' | 'sending' | 'sent' | 'failed';

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
  const [sendState, setSendState] = useState<SendState>('idle');
  const [isVerifying, setIsVerifying] = useState(false);
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
  // Re-entrancy guard for verification: auto-verify (6th digit / WebOTP) and
  // the fallback button can otherwise race and confirm() twice.
  const verifyingRef = React.useRef(false);
  // Monotonic send counter: if the user edits the number while a send is still
  // in flight, the stale send's result must not overwrite the new session.
  const sendSeqRef = React.useRef(0);
  const sendingMobileRef = React.useRef<string | null>(null);

  // Warm up Firebase Auth + the invisible reCAPTCHA while the user is typing
  // (or, on the hero handoff, in parallel with the auto-send) — script download
  // and widget render are the slowest part of the first OTP send.
  useEffect(() => {
    void prewarmFirebaseOtp();
  }, []);

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
      setCurrentMobile(applicationData.mobile);
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
      setTimer(60);
      void dispatchOtp(applicationData.mobile);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationData.mobile, applicationData.otpVerified]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'otp') {
      interval = setInterval(() => {
        setTimer((prev) => prev > 0 ? prev - 1 : 0);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step]);

  // Web OTP API (Chrome on Android): if the OS hands us the code from the SMS,
  // fill the boxes and verify without any typing. No-ops silently where the
  // API is unavailable (iOS relies on the keyboard's one-time-code suggestion,
  // handled by the input's autocomplete attribute instead).
  useEffect(() => {
    if (step !== 'otp' || !('OTPCredential' in window)) return;
    const ac = new AbortController();
    navigator.credentials
      .get({ otp: { transport: ['sms'] }, signal: ac.signal } as CredentialRequestOptions)
      .then((cred) => {
        const code = (cred as { code?: string } | null)?.code?.replace(/\D/g, '').slice(0, 6);
        if (code?.length === 6) {
          setOtpValue(code);
          void handleVerifyOtp(code);
        }
      })
      .catch(() => { /* aborted, dismissed, or unsupported — user types instead */ });
    return () => ac.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Step1FormData>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      fullName: applicationData.fullName || '',
      mobile: applicationData.mobile || '',
      consent: true,
    }
  });

  // Returning to the form (Edit pencil) must show the values being edited —
  // defaultValues are only captured at mount, before the hero-handoff store
  // hydration lands.
  useEffect(() => {
    if (step === 'form') {
      reset({
        fullName: applicationData.fullName || '',
        mobile: currentMobile || applicationData.mobile || '',
        consent: true,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  /**
   * Fire the SMS in the background — never awaited by navigation, so the OTP
   * screen is already visible while this runs. Duplicate-send protection:
   * skips if the same number is already in flight; a newer send supersedes a
   * stale one via the sequence counter.
   */
  const dispatchOtp = async (mobile: string, opts?: { resend?: boolean }) => {
    if (sendingMobileRef.current === mobile) return;
    sendingMobileRef.current = mobile;
    const seq = ++sendSeqRef.current;
    setSendState('sending');
    setApiError('');
    try {
      const confirmation = await sendFirebaseOtp(mobile);
      if (seq !== sendSeqRef.current) return; // superseded by a newer send
      confirmationRef.current = confirmation;
      setSendState('sent');
      setTimer(60);
      trackEvent(EVENTS.OTP_SENT, opts?.resend ? { resend: true } : undefined);
      if (opts?.resend) showToast('OTP resent successfully', 'success');
    } catch (err) {
      if (seq !== sendSeqRef.current) return;
      setSendState('failed');
      setApiError(firebaseOtpError(err));
      setTimer(0); // unlock Resend immediately — that's the retry path
    } finally {
      if (sendingMobileRef.current === mobile) sendingMobileRef.current = null;
    }
  };

  const handleSendOtp = (values: Step1FormData) => {
    updateData({ fullName: values.fullName });

    // Coming back from "edit number" without changing it: the previous OTP
    // session is still valid — return to the OTP screen without burning a
    // second SMS.
    if (values.mobile === currentMobile && confirmationRef.current && sendState === 'sent') {
      setStep('otp');
      return;
    }

    // Show the OTP screen IMMEDIATELY; the SMS dispatch runs in the background
    // and reports through the sendState status line.
    confirmationRef.current = null;
    setCurrentMobile(values.mobile);
    setOtpValue('');
    setOtpError('');
    setStep('otp');
    setTimer(60);
    void dispatchOtp(values.mobile);
  };

  const handleVerifyOtp = async (otp: string) => {
    if (verifyingRef.current || otp.length !== 6) return;

    if (!confirmationRef.current) {
      setOtpError(
        sendState === 'sending'
          ? 'Your OTP is still on its way — please try again in a moment.'
          : 'Session expired. Please resend the OTP.'
      );
      return;
    }

    verifyingRef.current = true;
    setIsVerifying(true);
    setOtpError('');

    // Confirm the code with Firebase, then exchange the signed-in user for an
    // ID token our server can verify.
    let idToken: string;
    try {
      const credential = await confirmationRef.current.confirm(otp);
      idToken = await credential.user.getIdToken();
    } catch (err) {
      verifyingRef.current = false;
      setIsVerifying(false);
      setOtpError(firebaseOtpError(err));
      // Clear the boxes so the user can retype immediately (the input
      // refocuses its first box on external clear).
      setOtpValue('');
      return;
    }

    const { error } = await otpService.verifyToken(currentMobile, idToken);
    if (error) {
      verifyingRef.current = false;
      setIsVerifying(false);
      setOtpError(error);
      return;
    }

    // OTP is verified — mark the store and move to the next step immediately.
    // isVerifying stays true so the UI shows "Verifying…" until navigation,
    // instead of flashing back to an idle state.
    // We deliberately do NOT block navigation on the draft-row write below: a
    // cold DB connection can take several seconds, and the user shouldn't wait
    // for it just to see the next form.
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

  // Auto-verify the moment the 6th digit lands (typed, pasted, or autofilled).
  // The "Continue to Verify" button remains as a fallback — e.g. after a
  // failed attempt, or if verification was skipped because the SMS dispatch
  // hadn't finished when the digits were entered.
  const handleOtpComplete = (otp: string) => {
    setOtpValue(otp);
    if (confirmationRef.current) void handleVerifyOtp(otp);
  };

  const handleResendOtp = () => {
    if (timer > 0 || isVerifying || sendState === 'sending') return;
    setOtpError('');
    setOtpValue('');
    void dispatchOtp(currentMobile, { resend: true });
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
                  disabled={isVerifying}
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
            <p className={styles.helperText}>As per PAN Card</p>
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
          </div>

          <div className={styles.ctaGroup}>
            <button
              type="submit"
              className={`btn btn--cta btn--lg ${styles.submitBtn}`}
            >
              Check Eligibility
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
              value={otpValue}
              onComplete={handleOtpComplete}
              onChange={setOtpValue}
              error={otpError}
              disabled={isVerifying}
              autoFocus
            />
          </div>

          {/* Live SMS delivery status — the inputs stay enabled throughout, so
              the user can start typing the moment the OTP arrives. */}
          {sendState === 'sending' && (
            <p className={`${styles.statusLine} ${styles.statusSending}`} role="status">
              <Loader2 size={14} className="spin" /> Sending OTP…
            </p>
          )}
          {sendState === 'sent' && otpValue === '' && !otpError && !isVerifying && (
            <p className={`${styles.statusLine} ${styles.statusSent}`} role="status">
              <CheckCircle2 size={14} /> OTP sent
            </p>
          )}

          {/* Surface send failures (e.g. auto-send on arrival from the landing
              page) here too — otherwise the OTP screen looks silently broken. */}
          {apiError && <p className={styles.errorText} role="alert">{apiError}</p>}

          <div className={styles.otpActions}>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={timer > 0 || isVerifying || sendState === 'sending'}
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
              disabled={isVerifying}
            />
            <label htmlFor="consentWhatsapp" className={styles.consentText}>
              Send me loan-related updates, alerts, and communications via WhatsApp on my registered mobile number. (Optional)
            </label>
          </div>

          {/* Fallback only: verification fires automatically on the 6th digit. */}
          <button
            type="button"
            onClick={() => handleVerifyOtp(otpValue)}
            className={`btn btn--cta btn--lg ${styles.submitBtn} ${(isVerifying || otpValue.length !== 6) ? 'btn--disabled' : ''}`}
            disabled={isVerifying || otpValue.length !== 6}
          >
            {isVerifying ? <><Loader2 size={18} className="spin" /> Verifying...</> : 'Continue to Verify'}
          </button>
          </div>
        </div>
      )}
    </div>
  );
}
