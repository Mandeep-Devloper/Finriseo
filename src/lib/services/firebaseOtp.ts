'use client';

// Client-side Firebase Phone Auth helpers.
//
// Flow: an invisible reCAPTCHA proves the request is human, Firebase sends the
// SMS via signInWithPhoneNumber(), and confirm(code) on the returned
// ConfirmationResult verifies it. The caller then exchanges the resulting user
// for an ID token and posts it to /api/otp/verify.

import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

// The reCAPTCHA element id rendered by the apply page.
const RECAPTCHA_CONTAINER = 'recaptcha-container';

let verifier: RecaptchaVerifier | null = null;

function getVerifier(): RecaptchaVerifier {
  if (!verifier) {
    verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER, {
      size: 'invisible',
    });
  }
  return verifier;
}

/**
 * Send an OTP SMS to an Indian mobile (10 digits, no country code).
 * Resolves with the ConfirmationResult used to verify the entered code.
 */
export function sendFirebaseOtp(mobile: string): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, `+91${mobile}`, getVerifier());
}

/** Map Firebase auth error codes to user-friendly messages. */
export function firebaseOtpError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Enter a valid mobile number.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    case 'auth/invalid-verification-code':
      return 'Wrong OTP. Please try again.';
    case 'auth/code-expired':
      return 'OTP expired. Request a new one.';
    case 'auth/captcha-check-failed':
    case 'auth/missing-app-credential':
      return 'Verification failed. Please refresh and try again.';
    default:
      return 'Could not send OTP. Please try again.';
  }
}
