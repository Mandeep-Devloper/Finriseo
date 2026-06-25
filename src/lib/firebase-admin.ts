// Firebase Admin SDK — server-side only. Used to verify the Firebase ID token
// the client gets after a successful Phone Auth, so we can trust that the
// mobile number really was OTP-verified before we accept the application.
//
// Required env (from Firebase Console → Project settings → Service accounts →
// Generate new private key):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (keep the literal \n newlines from the JSON)

import { initializeApp, getApps, getApp, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getServerEnv } from '@/lib/env';

// IMPORTANT: initialize lazily. If we call cert()/initializeApp() at module
// import time, `next build` evaluates it while "collecting page data" — when the
// FIREBASE_* env vars aren't present — and crashes with
// "Service account object must contain a string project_id property".
// Deferring to first request keeps the build clean and only needs the env at
// runtime.

function getAdminApp(): App {
  if (getApps().length) return getApp();
  // Fail fast with a clear message if any required server env is missing,
  // rather than letting cert() throw an opaque "must contain project_id" error.
  const env = getServerEnv();
  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

/** Returns the Firebase Admin Auth instance, initializing the app on first use. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
