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
 * Tear down the current reCAPTCHA verifier so the next send recreates it.
 * The invisible widget can be left in a stale/used state after a failed send
 * or after a one-shot verification, which makes subsequent sends silently
 * fail; clearing forces a fresh challenge.
 */
function resetVerifier(): void {
  try {
    verifier?.clear();
  } catch {
    /* widget may already be gone — ignore */
  }
  verifier = null;
}

/**
 * Send an OTP SMS to an Indian mobile (10 digits, no country code).
 * Resolves with the ConfirmationResult used to verify the entered code.
 * On failure the reCAPTCHA verifier is reset so a retry/resend works.
 */
export async function sendFirebaseOtp(mobile: string): Promise<ConfirmationResult> {
  console.info('[firebase-otp] Sending OTP to', `+91${mobile}`);
  try {
    const result = await signInWithPhoneNumber(auth, `+91${mobile}`, getVerifier());
    console.info('[firebase-otp] SMS dispatched OK — confirmation session ready.');
    return result;
  } catch (err) {
    resetVerifier();
    logFirebaseDiagnostic(err);
    throw err;
  }
}

/**
 * Log the raw Firebase error code plus a concrete "fix it from the Firebase
 * end" hint. This is the fastest way to tell whether an OTP failure is a
 * console/billing configuration problem vs. user input.
 */
function logFirebaseDiagnostic(err: unknown): void {
  const code = (err as { code?: string })?.code ?? 'unknown';
  const message = (err as { message?: string })?.message ?? '';
  const hints: Record<string, string> = {
    'auth/billing-not-enabled':
      'Project is on the free Spark plan → real SMS is blocked. Upgrade to the BLAZE plan, OR use a configured Firebase TEST phone number for dev.',
    'auth/operation-not-allowed':
      'Either Phone sign-in is disabled, or the SMS region is not allowlisted. Firebase Console → Authentication → Sign-in method → enable Phone + add India (IN) to SMS regions.',
    'auth/invalid-app-credential':
      'reCAPTCHA/App credential rejected — usually the current domain is NOT in Authentication → Settings → Authorized domains. Add localhost AND your Vercel prod domain.',
    'auth/captcha-check-failed':
      'reCAPTCHA token rejected. Check Authorized domains + App Check / reCAPTCHA Enterprise config.',
    'auth/too-many-requests':
      'Hit Firebase abuse/quota limits for this number or device. Wait, or raise per-day SMS quota in the console.',
    'auth/quota-exceeded':
      'Project SMS quota exhausted. Raise quota (Blaze) in Firebase Console.',
  };
  console.error(
    `[firebase-otp] SEND FAILED — code="${code}"`,
    { message },
    '\n→ Firebase-end action:', hints[code] ?? 'No specific console fix mapped; check the code above against Firebase Auth error reference.'
  );
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
