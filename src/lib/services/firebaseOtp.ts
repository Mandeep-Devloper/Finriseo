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
  signInWithCustomToken,
  type ConfirmationResult,
} from 'firebase/auth';
import { getClientAuth } from '@/lib/firebase-client';

// ── DEV-ONLY OTP bypass ──────────────────────────────────────────────
// Firebase blocks Phone Auth SMS on the free Spark plan. When the bypass is
// on, sendFirebaseOtp() skips the SMS and returns a stand-in confirmation
// whose confirm(code) accepts the fixed dev code, then performs a REAL
// sign-in via a server-minted custom token (/api/otp/dev-bypass) — so the
// rest of the flow (ID token, /api/otp/verify, session cookie) is untouched.
// Both conditions are compile-time constants: in a production build this is
// `false` and the branch is dead code.
export const OTP_DEV_BYPASS =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_OTP_DEV_BYPASS === '1';
export const OTP_DEV_BYPASS_CODE = '123456';

// The reCAPTCHA element id rendered by the apply page.
const RECAPTCHA_CONTAINER = 'recaptcha-container';

let verifier: RecaptchaVerifier | null = null;

function getVerifier(): RecaptchaVerifier {
  if (!verifier) {
    // Drop any stale widget left in the container — e.g. when Fast Refresh (or
    // a failed clear()) resets our module state while the DOM keeps the old
    // iframe. Rendering a new verifier into a non-empty container throws
    // "reCAPTCHA has already been rendered in this element".
    document.getElementById(RECAPTCHA_CONTAINER)?.replaceChildren();
    verifier = new RecaptchaVerifier(getClientAuth(), RECAPTCHA_CONTAINER, {
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
  if (OTP_DEV_BYPASS) {
    console.info(
      `[firebase-otp] DEV BYPASS active — no SMS sent. Enter OTP ${OTP_DEV_BYPASS_CODE}.`
    );
    return devBypassConfirmation(mobile);
  }
  try {
    // Always start from a fresh verifier: reCAPTCHA tokens are single-use, so
    // reusing the widget from a previous send (e.g. on Resend) gets its spent
    // token rejected with auth/invalid-app-credential.
    resetVerifier();
    const result = await signInWithPhoneNumber(getClientAuth(), `+91${mobile}`, getVerifier());
    console.info('[firebase-otp] SMS dispatched OK — confirmation session ready.');
    return result;
  } catch (err) {
    resetVerifier();
    logFirebaseDiagnostic(err);
    throw err;
  }
}

/**
 * Stand-in ConfirmationResult for the dev bypass. confirm(code) checks the
 * fixed dev code, then swaps the SMS proof for a server-minted custom token
 * and signs in with it for real — producing a genuine ID token that carries
 * the phone_number claim the server verifies.
 */
function devBypassConfirmation(mobile: string): ConfirmationResult {
  return {
    verificationId: 'dev-bypass',
    confirm: async (code: string) => {
      if (code !== OTP_DEV_BYPASS_CODE) {
        throw Object.assign(new Error('Invalid dev OTP'), {
          code: 'auth/invalid-verification-code',
        });
      }
      const res = await fetch('/api/otp/dev-bypass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.customToken) {
        throw Object.assign(new Error('Dev bypass mint failed'), {
          code: 'auth/internal-error',
        });
      }
      return signInWithCustomToken(getClientAuth(), data.customToken);
    },
  };
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
    case 'auth/billing-not-enabled':
    case 'auth/quota-exceeded':
      // Service-side config/quota problem — not something the user can fix by
      // retrying with different input. (Console diagnostic has the real fix.)
      return 'OTP service is temporarily unavailable. Please try again shortly.';
    default:
      return 'Could not send OTP. Please try again.';
  }
}
