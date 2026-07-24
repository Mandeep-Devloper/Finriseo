'use client';

import React, { useEffect, useRef } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { sanitizePincode } from '@/lib/pincode';
import {
  usePincodeLookup,
  type PincodeLookupState,
} from '@/hooks/usePincodeLookup';
import styles from './PincodeInput.module.css';

interface PincodeInputProps {
  id?: string;
  name?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  /** Fires whenever the lookup result changes — parent uses it to store the
   *  location and gate form submission. */
  onResult?: (result: PincodeLookupState) => void;
  /** External (schema/RHF) message for a format error, shown only when the async
   *  lookup has nothing to say. */
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Self-contained, reusable PIN-code field: numeric-only input that auto-detects
 * and displays the location (District, State) for a valid PIN. All fetching /
 * debounce / caching lives in usePincodeLookup — this component only renders.
 */
export function PincodeInput({
  id = 'pinCode',
  name = 'pinCode',
  label = 'Current Address PIN Code',
  value,
  onChange,
  onResult,
  error,
  disabled,
  placeholder = 'Enter PIN Code',
}: PincodeInputProps) {
  const result = usePincodeLookup(value);
  const { status, location } = result;

  // Push results up without making the parent's callback a re-render trigger.
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  useEffect(() => {
    onResultRef.current?.(result);
  }, [result]);

  const statusId = `${id}-status`;
  const showFormatError = status === 'idle' && Boolean(error);
  const isInvalid = status === 'invalid' || showFormatError;

  return (
    <div className="form-group">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder={placeholder}
        maxLength={6}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(sanitizePincode(e.target.value))}
        className={`form-input ${isInvalid ? 'form-input--error' : ''}`}
        aria-invalid={isInvalid || undefined}
        aria-describedby={statusId}
      />

      {/* Single live region so screen readers announce each state transition. */}
      <div id={statusId} aria-live="polite" className={styles.status}>
        {status === 'loading' && (
          <span className={styles.verifying} role="status">
            <Loader2 size={14} className="spin" aria-hidden="true" />
            Verifying PIN Code…
          </span>
        )}

        {status === 'success' && location && (
          <span className={styles.success} role="status">
            <MapPin size={14} aria-hidden="true" />
            {location.district}, {location.state}
          </span>
        )}

        {status === 'invalid' && (
          <span className={styles.error} role="alert">
            ❌ Invalid PIN Code
          </span>
        )}

        {status === 'error' && (
          <span className={styles.error} role="alert">
            Unable to verify PIN Code. Please try again.
          </span>
        )}

        {showFormatError && (
          <span className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
