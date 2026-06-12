'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step4Schema, Step4FormData } from '@/lib/validations';
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

  const onSubmit: SubmitHandler<Step4FormData> = (data) => {
    updateData({
      panNumber: data.panNumber.toUpperCase(), // Ensure uppercase
    });
    router.push('/apply/offers');
  };

  // Prevent hydration flash
  if (!mounted || !applicationData.mobile || !applicationData.otpVerified) {
    return null;
  }

  return (
    <div className={styles.container}>
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
              className={`form-input ${styles.uppercaseInput} ${errors.panNumber ? 'error' : ''}`}
              {...register('panNumber', {
                onChange: (e) => {
                  e.target.value = e.target.value.toUpperCase();
                }
              })}
            />
            {errors.panNumber && (
              <p className={styles.errorText}>{errors.panNumber.message}</p>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push('/apply/employment')}
            className={`btn btn--ghost ${styles.backBtn}`}
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <button
            type="submit"
            className="btn btn--cta"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Check your loan offers'}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
