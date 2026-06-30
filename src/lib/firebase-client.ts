'use client';

// Firebase client SDK — used for Phone Authentication (OTP) in the browser and
// Email/Password for admin login. Firebase owns the OTP: it sends the SMS (after
// a reCAPTCHA check) and verifies the code. We then hand the resulting ID token
// to our server for trust.
//
// Required env (all public — safe to expose):
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
//   NEXT_PUBLIC_FIREBASE_APP_ID
//
// IMPORTANT: initialization is LAZY. getAuth() must NOT run at module import,
// because Next pre-renders client pages at build time — and if the public env
// vars aren't present in that environment (e.g. a Vercel Preview deploy scoped to
// Production-only vars), getAuth() throws `auth/invalid-api-key` and the BUILD
// crashes. Deferring to getClientAuth() (called only in the browser, inside event
// handlers) keeps the build green; a genuinely missing key then surfaces as a
// clear runtime error where it belongs, not a build failure.

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cachedAuth: Auth | null = null;

/**
 * Returns the Firebase Auth instance, initializing the app on first use (browser
 * only). Diagnostics about missing config are surfaced here — when auth is
 * actually needed — rather than at import time.
 */
export function getClientAuth(): Auth {
  if (cachedAuth) return cachedAuth;

  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error(
      '[firebase-client] Missing config keys:', missing,
      '→ set the corresponding NEXT_PUBLIC_FIREBASE_* env vars (locally AND in Vercel, for the environment being deployed).'
    );
  } else {
    console.info(
      '[firebase-client] Initialized',
      { projectId: firebaseConfig.projectId, authDomain: firebaseConfig.authDomain }
    );
  }

  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  cachedAuth = getAuth(app);
  // Send the SMS in the user's device language when available.
  cachedAuth.useDeviceLanguage();
  return cachedAuth;
}
