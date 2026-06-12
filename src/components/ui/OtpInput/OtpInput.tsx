'use client';

import React, { useState, useRef, KeyboardEvent, ClipboardEvent } from 'react';
import styles from './OtpInput.module.css';

interface OtpInputProps {
  length?: number;
  onComplete: (otp: string) => void;
  error?: string;
  disabled?: boolean;
}

export function OtpInput({ length = 6, onComplete, error, disabled = false }: OtpInputProps) {
  const [otp, setOtp] = useState<string[]>(new Array(length).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = (index: number) => {
    const nextIndex = Math.max(0, Math.min(length - 1, index));
    inputRefs.current[nextIndex]?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value;
    
    // Only accept numbers
    if (value && !/^\d+$/.test(value)) return;
    
    // Take the last character typed if they type fast
    const char = value.slice(-1);
    
    const newOtp = [...otp];
    newOtp[index] = char;
    setOtp(newOtp);

    // If filled, move to next
    if (char) {
      focusInput(index + 1);
    }

    const currentOtp = newOtp.join('');
    if (currentOtp.length === length) {
      onComplete(currentOtp);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otp[index] && index > 0) {
        // Move to previous input and clear it
        const newOtp = [...otp];
        newOtp[index - 1] = '';
        setOtp(newOtp);
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

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    
    if (pastedData) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedData.length; i++) {
        newOtp[i] = pastedData[i];
      }
      setOtp(newOtp);
      
      const nextIndex = Math.min(pastedData.length, length - 1);
      focusInput(nextIndex);

      if (pastedData.length === length) {
        onComplete(newOtp.join(''));
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.inputWrapper} role="group" aria-label="Enter OTP">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            disabled={disabled}
            aria-label={`OTP digit ${i + 1}`}
            className={`${styles.input} ${error ? styles.inputError : ''}`}
          />
        ))}
      </div>
      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
}
