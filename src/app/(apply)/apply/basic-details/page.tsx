'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft } from 'lucide-react';
import { useApplicationStore } from '@/store/applicationStore';
import { step2Schema, Step2FormData } from '@/lib/validations';
import { applicationService } from '@/lib/services';
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

  const {
    register,
    handleSubmit,
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

  const onSubmit = async (data: Step2FormData) => {
    updateData({
      loanAmount: data.loanAmount,
      email: data.email,
      pinCode: data.pinCode,
    });
    if (applicationData.referenceId) {
      await applicationService.updateApplication(applicationData.referenceId, {
        loanAmount: data.loanAmount,
        email: data.email,
        pinCode: data.pinCode,
        currentStep: 'basic_details',
      });
    }
    router.push('/apply/employment');
  };

  if (!mounted || !applicationData.mobile || !applicationData.otpVerified) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Mobile image slot — add your step image here */}
      <div className={styles.mobileImageSlot} />
      <div className={styles.mobileTop}>
        <button
          type="button"
          onClick={() => router.push('/apply')}
          className={styles.backIconBtn}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
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
              {...register('loanAmount')}
            />
            {errors.loanAmount && (
              <p className={styles.errorText}>{errors.loanAmount.message}</p>
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
              {...register('email')}
            />
            {errors.email && (
              <p className={styles.errorText}>{errors.email.message}</p>
            )}
          </div>

          {/* Current Address PIN Code */}
          <div className="form-group">
            <label htmlFor="pinCode" className="form-label">
              Current Address PIN Code
            </label>
            <input
              id="pinCode"
              type="text"
              placeholder="Enter PIN Code"
              maxLength={6}
              className={`form-input ${errors.pinCode ? 'error' : ''}`}
              {...register('pinCode')}
            />
            {errors.pinCode && (
              <p className={styles.errorText}>{errors.pinCode.message}</p>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push('/apply')}
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
            {isSubmitting ? 'Saving...' : 'Save & Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
