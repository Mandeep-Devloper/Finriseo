"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useApplicationStore } from "@/store/applicationStore";
import { step3Schema, Step3FormData } from "@/lib/validations";
import { trackEvent, EVENTS } from '@/lib/analytics';
import styles from "./page.module.css";

export default function EmploymentStep() {
  const router = useRouter();
  const updateData = useApplicationStore((state) => state.updateData);
  const applicationData = useApplicationStore((state) => state);
  const [mounted, setMounted] = useState(false);

  // Secure Route Guard
  useEffect(() => {
    setMounted(true);
    if (!applicationData.mobile || !applicationData.otpVerified) {
      router.replace("/apply");
    }
  }, [applicationData.mobile, applicationData.otpVerified, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<Step3FormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(step3Schema) as any,
    defaultValues: {
      monthlyIncome: applicationData.monthlyIncome
        ? Number(applicationData.monthlyIncome)
        : undefined,
      employmentType: applicationData.employmentType || "",
      salaryMode: applicationData.salaryMode || "",
    },
  });

  const selectedEmploymentType = watch("employmentType");

  const onSubmit: SubmitHandler<Step3FormData> = (data) => {
    updateData({
      monthlyIncome: data.monthlyIncome,
      employmentType: data.employmentType,
      salaryMode: data.salaryMode,
    });
    trackEvent(EVENTS.EMPLOYMENT_SUBMITTED, { employmentType: data.employmentType });
    router.push("/apply/pan");
  };

  // Prevent hydration flash of the protected form
  if (!mounted || !applicationData.mobile || !applicationData.otpVerified) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Your employment details</h2>
        <p className={styles.subtitle}>
          Complete your profile to unlock personalized loan offers.
        </p>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <form onSubmit={handleSubmit(onSubmit as any)} className={styles.form}>
        <div className={styles.grid}>
          {/* Monthly In-Hand Salary */}
          <div className="form-group">
            <label htmlFor="monthlyIncome" className="form-label">
              Monthly In-Hand Salary(₹)
            </label>
            <input
              id="monthlyIncome"
              type="number"
              placeholder="eg ₹40,000"
              className={`form-input ${errors.monthlyIncome ? "error" : ""}`}
              {...register("monthlyIncome")}
            />
            {errors.monthlyIncome && (
              <p className={styles.errorText}>{errors.monthlyIncome.message}</p>
            )}
          </div>

          {/* Employment Type — Pill Toggle */}
          <div className="form-group">
            <label className="form-label">Employment Type</label>
            <div className={styles.pillGroup}>
              <label className={`${styles.pill} ${selectedEmploymentType === 'Salaried' ? styles.pillActive : ''}`}>
                <input
                  type="radio"
                  value="Salaried"
                  className={styles.pillRadio}
                  {...register("employmentType")}
                />
                Salaried
              </label>
              <label className={`${styles.pill} ${selectedEmploymentType === 'Self Employed' ? styles.pillActive : ''}`}>
                <input
                  type="radio"
                  value="Self Employed"
                  className={styles.pillRadio}
                  {...register("employmentType")}
                />
                Self Employed
              </label>
            </div>
            {errors.employmentType && (
              <p className={styles.errorText}>
                {errors.employmentType.message}
              </p>
            )}
          </div>

          {/* Salary Mode — Pill Toggle */}
          <div className="form-group">
            <label className="form-label">How Do You Receive Your Salary?</label>
            <div className={styles.pillGroup}>
              {["Bank", "Cash", "Cheque"].map((mode) => (
                <label
                  key={mode}
                  className={`${styles.pill} ${watch("salaryMode") === mode ? styles.pillActive : ""}`}
                >
                  <input
                    type="radio"
                    value={mode}
                    className={styles.pillRadio}
                    {...register("salaryMode")}
                  />
                  {mode}
                </label>
              ))}
            </div>
            {errors.salaryMode && (
              <p className={styles.errorText}>{errors.salaryMode.message}</p>
            )}
          </div>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => router.push("/apply/basic-details")}
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
            {isSubmitting ? "Saving..." : "Continue to Verify"}
            {!isSubmitting && <ArrowRight size={16} />}
          </button>
        </div>
      </form>
    </div>
  );
}
