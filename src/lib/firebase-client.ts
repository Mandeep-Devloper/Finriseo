'use client';

// Firebase client SDK — used for Phone Authentication (OTP) in the browser.
// Firebase owns the OTP: it sends the SMS (after a reCAPTCHA check) and verifies
// the code. We then hand the resulting ID token to our server for trust.
//
// Required env (all public — safe to expose):
//   NEXT_PUBLIC_FIREBASE_API_KEY
//   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
//   NEXT_PUBLIC_FIREBASE_PROJECT_ID
//   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
//   NEXT_PUBLIC_FIREBASE_APP_ID

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Diagnostic: surface which public Firebase config is actually loaded in the
// browser so you can confirm the right project/domain is wired up. Flags any
// missing NEXT_PUBLIC_FIREBASE_* values (the #1 cause of OTP silently failing).
const missing = Object.entries(firebaseConfig)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(
    '[firebase-client] Missing config keys:', missing,
    '→ set the corresponding NEXT_PUBLIC_FIREBASE_* env vars (locally AND in Vercel).'
  );
} else {
  console.info(
    '[firebase-client] Initialized',
    { projectId: firebaseConfig.projectId, authDomain: firebaseConfig.authDomain }
  );
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Send the SMS in the user's device language when available.
auth.useDeviceLanguage();
