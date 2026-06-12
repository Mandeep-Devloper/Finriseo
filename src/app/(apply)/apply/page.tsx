'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step1Schema, Step1FormData } from '@/lib/validations';
import { OtpInput } from '@/components/ui/OtpInput';
import { useToast } from '@/components/ui/Toast';
import { otpService } from '@/lib/services';
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
  
  const hasAutoSent = React.useRef(false);

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
    const { data, error } = await otpService.sendOtp(values.mobile);
    setIsLoading(false);
    if (error) { setApiError(error); return; }
    if (process.env.NODE_ENV === 'development' && data?._devOtp) {
      console.log('%c DEV OTP: ' + data._devOtp, 
        'background: #16a34a; color: white; font-size: 16px; padding: 4px 8px;');
    }
    updateData({ fullName: values.fullName });
    setCurrentMobile(values.mobile);
    setStep('otp');
  };

  const handleVerifyOtp = async (otp: string) => {
    setIsLoading(true);
    setOtpError('');
    const { error } = await otpService.verifyOtp(currentMobile, otp);
    setIsLoading(false);
    if (error) { setOtpError(error); return; }
    updateData({ mobile: currentMobile, otpVerified: true });
    router.push('/apply/basic-details');
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    setOtpError('');
    const { error } = await otpService.resendOtp(currentMobile);
    if (error) {
      setOtpError(error);
    } else {
      setTimer(60);
      showToast('OTP resent successfully', 'success');
    }
  };

  return (
    <div className={styles.container}>
      {/* Mobile-only hero image — only shown on the form step, not OTP */}
      {step === 'form' ? (
        <div className={styles.mobileHero}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/firststep.svg" alt="Financial Freedom" className={styles.heroImage} />
        </div>
      ) : (
        <div className={styles.mobileHeroSpacer} />
      )}

      <div className={styles.header}>
        <h2 className={styles.title}>
          {step === 'form' ? 'Get personalized Loan Offers' : 'OTP Verification'}
        </h2>
        <p className={styles.subtitle}>
          {step === 'form' 
            ? 'Get a Loan up to ₹50,00,000 in Minutes.' 
            : `We've sent a 6-digit OTP code to +91 ${currentMobile}`}
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
                placeholder="9876543210"
                maxLength={10}
                className={`${styles.input} ${errors.mobile ? styles.inputError : ''}`}
                {...register('mobile')}
              />
            </div>
            {errors.mobile && <p className={styles.errorText}>{errors.mobile.message}</p>}
            {apiError && <p className={styles.errorText} role="alert">{apiError}</p>}
          </div>

          <div className={styles.consentBox}>
            <input
              type="checkbox"
              id="consent"
              className={styles.checkbox}
              {...register('consent')}
            />
            <label htmlFor="consent" className={styles.consentText}>
              By proceeding, you agree to our <Link href="/terms" className={styles.link}>T&C</Link> and <Link href="/privacy-policy" className={styles.link}>Privacy Policy</Link> and consent to receive communication via WhatsApp, RCS & SMS. I authorize Finriseo to credit/debit my account and declare I am not a PEP.
            </label>
          </div>
          {errors.consent && <p className={styles.errorText} role="alert">{errors.consent.message}</p>}

          <button 
            type="submit" 
            className={`btn btn--cta btn--lg ${styles.submitBtn} ${isLoading ? 'btn--disabled' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? <><Loader2 size={18} className="spin" /> Sending...</> : 'Check Eligibility'}
            {!isLoading && <ArrowRight size={20} />}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <div className={styles.form}>
          <div className={styles.otpWrapper}>
            <OtpInput 
              length={6} 
              onComplete={handleVerifyOtp} 
              error={otpError}
              disabled={isLoading}
            />
          </div>

          {isLoading && <p className={styles.verifyingText}>Verifying code...</p>}

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

          <button 
            type="button" 
            onClick={() => setStep('form')}
            className={styles.backBtn}
            disabled={isLoading}
            aria-label="Go back to previous step"
          >
            <ArrowLeft size={16} />
            Change Mobile Number
          </button>
        </div>
      )}
    </div>
  );
}
