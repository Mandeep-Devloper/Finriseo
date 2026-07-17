'use client';

import React, { useState, useRef, useEffect, KeyboardEvent, ClipboardEvent, FocusEvent } from 'react';
import styles from './OtpInput.module.css';

interface OtpInputProps {
  length?: number;
  /** Controlled OTP value — the parent owns it so it can clear (wrong OTP) or
      fill it from outside (WebOTP API autofill). */
  value: string;
  onChange: (otp: string) => void;
  onComplete: (otp: string) => void;
  error?: string;
  disabled?: boolean;
  /** Focus the first box on mount / after an external clear — pops the numeric
      keyboard on mobile without an extra tap. */
  autoFocus?: boolean;
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  onComplete,
  error,
  disabled = false,
  autoFocus = false,
}: OtpInputProps) {
  const [otp, setOtp] = useState<string[]>(() => Array.from({ length }, (_, i) => value[i] ?? ''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Adopt external writes from the parent (clear after a wrong OTP, WebOTP
  // autofill). Internal edits round-trip through onChange, so when the joined
  // digits already equal `value` there is nothing to sync.
  useEffect(() => {
    setOtp((prev) =>
      prev.join('') === value ? prev : Array.from({ length }, (_, i) => value[i] ?? '')
    );
  }, [value, length]);

  useEffect(() => {
    if (autoFocus && !disabled && value === '') inputRefs.current[0]?.focus();
  }, [autoFocus, disabled, value]);

  const focusInput = (index: number) => {
    const nextIndex = Math.max(0, Math.min(length - 1, index));
    inputRefs.current[nextIndex]?.focus();
  };

  const commit = (newOtp: string[]) => {
    setOtp(newOtp);
    const joined = newOtp.join('');
    onChange(joined);
    if (joined.length === length) onComplete(joined);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const raw = e.target.value.replace(/\D/g, '');

    // Box cleared (backspace on a filled box).
    if (!raw) {
      const newOtp = [...otp];
      newOtp[index] = '';
      commit(newOtp);
      return;
    }

    // Multiple digits landed in one box: OS keyboard OTP autofill (iOS
    // "one-time-code" / Android SMS suggestion) inserts the whole code into the
    // focused input, and fast typists can beat the re-render. Distribute the
    // digits across the boxes — a full code always restarts from the first box.
    if (raw.length > 1) {
      const start = raw.length >= length ? 0 : index;
      const digits = raw.slice(0, length);
      const newOtp = [...otp];
      for (let i = 0; i < digits.length && start + i < length; i++) {
        newOtp[start + i] = digits[i];
      }
      commit(newOtp);
      focusInput(start + digits.length);
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = raw;
    commit(newOtp);
    focusInput(index + 1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous input and clear it
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        commit(newOtp);
        focusInput(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusInput(index - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusInput(index + 1);
    }
  };

  // Select the digit when a filled box is focused so typing replaces it —
  // avoids the "two characters in one box" ambiguity entirely.
  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    e.target.select();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);

    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      focusInput(Math.min(pastedData.length, length - 1));
      commit(newOtp);
    }
  };

  const errorId = 'otp-error';
  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper} role="group" aria-label="Enter the 6-digit OTP">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            // "one-time-code" on every box: OS autofill targets the *focused*
            // input, which may not be the first. maxLength must admit the whole
            // code for the same reason; handleChange redistributes the digits.
            autoComplete="one-time-code"
            maxLength={length}
            value={digit}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onFocus={handleFocus}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label={`OTP digit ${i + 1}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`${styles.input} ${error ? styles.inputError : ''}`}
          />
        ))}
      </div>
      {/* role=alert so screen readers announce a wrong/expired OTP immediately. */}
      {error && <p id={errorId} role="alert" className={styles.errorText}>{error}</p>}
    </div>
  );
}
