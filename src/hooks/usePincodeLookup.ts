'use client';

import { useEffect, useState } from 'react';
import { validatePincode, type PincodeLocation } from '@/lib/pincode';

export type PincodeLookupStatus = 'idle' | 'loading' | 'success' | 'invalid' | 'error';

export interface PincodeLookupState {
  status: PincodeLookupStatus;
  location: PincodeLocation | null;
}

// Definitive outcomes only (success / invalid) are cacheable — a transient
// 'error' must stay retryable. Module scope = one cache for the whole session, so
// a given PIN is fetched from the network at most once (dedupe + no repeats).
type CachedResult =
  | { status: 'success'; location: PincodeLocation }
  | { status: 'invalid' };

const cache = new Map<string, CachedResult>();

// A PIN is *complete* at exactly 6 digits (the field caps at 6 and only a valid
// 6-digit value ever reaches the fetch), so there's nothing to "wait for typing
// to stop" on — a long debounce here is pure dead time the user feels as lag. We
// keep a short debounce only to coalesce the final keystroke / a quick
// backspace-and-retype and to absorb React Strict Mode's double effect run.
const DEBOUNCE_MS = 120;

const IDLE: PincodeLookupState = { status: 'idle', location: null };

/**
 * Resolves an Indian PIN code to a location. Fires the network lookup only when
 * the input is a structurally valid PIN (never for 1–5 digits or bad format),
 * after a short debounce, and never twice for the same PIN in a session. Every
 * input change cancels the previous in-flight request.
 */
export function usePincodeLookup(pincode: string): PincodeLookupState {
  const [state, setState] = useState<PincodeLookupState>(() =>
    resolveFromCache(pincode)
  );

  useEffect(() => {
    if (!validatePincode(pincode)) {
      setState(IDLE);
      return;
    }

    const cached = cache.get(pincode);
    if (cached) {
      setState(toState(cached));
      return;
    }

    // `active` gates state updates so a debounce/abort cleanup (Strict Mode
    // double-invoke, or the user typing on) can't land a stale result.
    let active = true;
    const controller = new AbortController();

    setState({ status: 'loading', location: null });

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/pincode/${pincode}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as
          | CachedResult
          | { status: 'error' };

        if (!active) return;

        if (data.status === 'success' || data.status === 'invalid') {
          cache.set(pincode, data);
          setState(toState(data));
        } else {
          setState({ status: 'error', location: null });
        }
      } catch (err) {
        // Abort is the expected path when the input changes — not an error.
        if (!active || (err instanceof DOMException && err.name === 'AbortError')) {
          return;
        }
        setState({ status: 'error', location: null });
      }
    }, DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [pincode]);

  return state;
}

function toState(result: CachedResult): PincodeLookupState {
  return result.status === 'success'
    ? { status: 'success', location: result.location }
    : { status: 'invalid', location: null };
}

function resolveFromCache(pincode: string): PincodeLookupState {
  if (!validatePincode(pincode)) return IDLE;
  const cached = cache.get(pincode);
  return cached ? toState(cached) : IDLE;
}
