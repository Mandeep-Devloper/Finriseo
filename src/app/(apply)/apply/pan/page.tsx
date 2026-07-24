'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Lock } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step4Schema, Step4FormData } from '@/lib/validations';
import { useAutosave } from '@/hooks/useAutosave';
import { useResumeApplication } from '@/hooks/useResumeApplication';
import styles from './page.module.css';

export default function PanStep() {
  const router = useRouter();
  const updateData = useApplicationStore((state) => state.updateData);
  const applicationData = useApplicationStore((state) => state);
  const [mounted, setMounted] = useState(false);

  const { saveStep } = useAutosave(applicationData.referenceId || undefined);

  // Secure Route Guard — with Magic Resume: restore from the server when the
  // in-memory store is empty (fresh browser resuming via the trusted cookie).
  const storeReady = Boolean(applicationData.mobile && applicationData.otpVerified);
  const { status: resumeStatus } = useResumeApplication({ enabled: !storeReady });
  useEffect(() => {
    setMounted(true);
    if (!storeReady && resumeStatus === 'none') {
      router.replace('/apply');
    }
  }, [storeReady, resumeStatus, router]);

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
    // Persist in the background so the step change is instant. saveStep records
    // resume metadata and the PATCH route encrypts PAN into its own column, while
    // stripping it from the resumable draftData snapshot — so PAN is never stored
    // in a form that could be restored client-side.
    saveStep('pan_verified', { panNumber });
    router.push('/apply/offers');
  };

  // Prevent hydration flash
  if (!mounted) return null;
  if (!storeReady && resumeStatus === 'loading') return null;
  if (!storeReady && resumeStatus === 'none') return null;

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
