// Firebase Admin SDK — server-side only. Used to verify the Firebase ID token
// the client gets after a successful Phone Auth, so we can trust that the
// mobile number really was OTP-verified before we accept the application.
//
// Required env (from Firebase Console → Project settings → Service accounts →
// Generate new private key):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (keep the literal \n newlines from the JSON)

import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const app = getApps().length
  ? getApp()
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });

export const adminAuth = getAuth(app);
