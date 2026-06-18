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

// IMPORTANT: initialize lazily. If we call cert()/initializeApp() at module
// import time, `next build` evaluates it while "collecting page data" — when the
// FIREBASE_* env vars aren't present — and crashes with
// "Service account object must contain a string project_id property".
// Deferring to first request keeps the build clean and only needs the env at
// runtime.

function getAdminApp(): App {
  if (getApps().length) return getApp();
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

/** Returns the Firebase Admin Auth instance, initializing the app on first use. */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}
