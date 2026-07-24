'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useApplicationStore } from '@/store/applicationStore';
import { step2Schema, Step2FormData } from '@/lib/validations';
import { applicationService } from '@/lib/services';
import { PincodeInput } from '@/components/ui/PincodeInput/PincodeInput';
import type { PincodeLookupState } from '@/hooks/usePincodeLookup';
import styles from './page.module.css';

export default function BasicDetailsStep() {
  const router = useRouter();
  const updateData = useApplicationStore((state) => state.updateData);
  const applicationData = useApplicationStore((state) => state);
  const [mounted, setMounted] = useState(false);

  // Secure Route Guard
  useEffect(() => {
    setMounted(true);
    if (!applicationData.mobile || !applicationData.otpVerified) {
      router.replace('/apply');
    }
  }, [applicationData.mobile, applicationData.otpVerified, router]);

  // Async PIN verification lives outside RHF (the schema only checks format);
  // this holds the India Post result so we can show the location and block
  // submission on a confirmed-invalid PIN.
  const [pinResult, setPinResult] = useState<PincodeLookupState>({
    status: 'idle',
    location: null,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Step2FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step2Schema) as any,
    defaultValues: {
      loanAmount: applicationData.loanAmount ? Number(applicationData.loanAmount) : undefined,
      email: applicationData.email || '',
      pinCode: applicationData.pinCode || '',
    },
  });

  // Block progress while the PIN is still verifying or confirmed invalid. A
  // network error is deliberately NOT blocking — the format is already valid, so
  // an India Post outage shouldn't strand the applicant.
  const pinBlocksSubmit =
    pinResult.status === 'loading' || pinResult.status === 'invalid';

  const onSubmit = async (data: Step2FormData) => {
    if (pinBlocksSubmit) return;

    updateData({
      loanAmount: data.loanAmount,
      email: data.email,
      pinCode: data.pinCode,
      // Client-only enrichment — persisted in the store/sessionStorage, not sent
      // to the draft-save API (which has no columns for it).
      district: pinResult.location?.district ?? '',
      state: pinResult.location?.state ?? '',
      city: pinResult.location?.city ?? '',
    });
    // Persist the draft in the background so the step change is instant — we
    // don't block navigation on the network round-trip. The final submit on the
    // success page resends the full dataset, so a slow/failed draft-save here
    // never loses data.
    if (applicationData.referenceId) {
      void applicationService
        .updateApplication(applicationData.referenceId, {
          loanAmount: data.loanAmount,
          email: data.email,
          pinCode: data.pinCode,
          currentStep: 'basic_details',
        })
        .catch(() => {});
    }
    router.push('/apply/employment');
  };

  if (!mounted || !applicationData.mobile || !applicationData.otpVerified) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* No back control on the first post-OTP step: the only route back is the
          OTP screen, which is a sealed checkpoint (resend burns another SMS and
          the confirmation session is already spent → "Session expired"). */}
      <div className={styles.mobileTop}>
        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <span className={`${styles.seg} ${styles.segOn}`} />
            <span className={styles.seg} />
            <span className={styles.seg} />
          </div>
          <span className={styles.stepFraction}>1/3</span>
        </div>
      </div>

      <div className={styles.header}>
        <h2 className={styles.title}>Fill your basic details</h2>
        <p className={styles.subtitle}>
          Complete your income profile to unlock personalized loan offers.
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} className={styles.form}>
        <div className={styles.grid}>
          {/* Desired Loan Amount */}
          <div className="form-group">
            <label htmlFor="loanAmount" className="form-label">
              Desired loan amount(₹)
            </label>
            <input
              id="loanAmount"
              type="number"
              placeholder="eg ₹2,00,000"
              className={`form-input ${errors.loanAmount ? 'error' : ''}`}
              aria-invalid={errors.loanAmount ? true : undefined}
              aria-describedby={errors.loanAmount ? 'loanAmount-error' : undefined}
              {...register('loanAmount')}
            />
            {errors.loanAmount && (
              <p id="loanAmount-error" role="alert" className={styles.errorText}>{errors.loanAmount.message}</p>
            )}
          </div>

          {/* Email Address */}
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className={`form-input ${errors.email ? 'error' : ''}`}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email && (
              <p id="email-error" role="alert" className={styles.errorText}>{errors.email.message}</p>
            )}
          </div>

          {/* Current Address PIN Code — auto-detects District, State */}
          <Controller
            name="pinCode"
            control={control}
            render={({ field }) => (
              <PincodeInput
                id="pinCode"
                value={field.value ?? ''}
                onChange={field.onChange}
                onResult={setPinResult}
                error={errors.pinCode?.message}
              />
            )}
          />
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className="btn btn--cta"
            disabled={isSubmitting || pinBlocksSubmit}
          >
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
