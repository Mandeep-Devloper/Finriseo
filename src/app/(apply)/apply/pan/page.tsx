'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Lock } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step4Schema, Step4FormData } from '@/lib/validations';
import { applicationService } from '@/lib/services';
import styles from './page.module.css';

export default function PanStep() {
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
  }, [applicationData, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Step4FormData>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      panNumber: applicationData.panNumber || '',
    },
  });

  const onSubmit: SubmitHandler<Step4FormData> = async (data) => {
    const panNumber = data.panNumber.toUpperCase();
    updateData({ panNumber });
    // Persist the draft in the background so the step change is instant — we
    // don't block navigation on the network round-trip. The final submit on the
    // success page resends the full dataset, so a slow/failed draft-save here
    // never loses data.
    if (applicationData.referenceId) {
      void applicationService
        .updateApplication(applicationData.referenceId, {
          panNumber,
          currentStep: 'pan_verified',
        })
        .catch(() => {});
    }
    router.push('/apply/offers');
  };

  // Prevent hydration flash
  if (!mounted || !applicationData.mobile || !applicationData.otpVerified) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.mobileTop}>
        <button
          type="button"
          onClick={() => router.push('/apply/employment')}
          className={styles.backIconBtn}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div className={styles.progressRow}>
          <div className={styles.progressTrack}>
            <span className={`${styles.seg} ${styles.segOn}`} />
            <span className={`${styles.seg} ${styles.segOn}`} />
            <span className={`${styles.seg} ${styles.segOn}`} />
          </div>
          <span className={styles.stepFraction}>3/3</span>
        </div>
      </div>

      <div className={styles.header}>
        <h2 className={styles.title}>Please verify your PAN</h2>
        <p className={styles.subtitle}>
          Complete your PAN verification to finish your application process.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
        <div className={styles.grid}>
          <div className="form-group">
            <label htmlFor="panNumber" className="form-label">
              PAN Number
            </label>
            <input
              id="panNumber"
              type="text"
              placeholder="e.g. ABCDE1234F"
              maxLength={10}
              autoComplete="off"
              autoCapitalize="characters"
              aria-invalid={errors.panNumber ? true : undefined}
              aria-describedby={errors.panNumber ? 'panNumber-error' : undefined}
              className={`form-input ${styles.uppercaseInput} ${errors.panNumber ? 'error' : ''}`}
              {...register('panNumber', {
                onChange: (e) => {
                  e.target.value = e.target.value.toUpperCase();
                }
              })}
            />
            {errors.panNumber && (
              <p id="panNumber-error" role="alert" className={styles.errorText}>{errors.panNumber.message}</p>
            )}
          </div>

          <p className={styles.secureNote}>
            <Lock size={14} />
            Secure &amp; Encrypted • Your data is protected
          </p>
        </div>

        <div className={styles.actions}>
          <button
            type="submit"
            className="btn btn--cta"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Check your loan offers'}
          </button>
        </div>
      </form>
    </div>
  );
}
