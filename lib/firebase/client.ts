/**
 * Firebase client SDK — null-safe initialization.
 *
 * If the NEXT_PUBLIC_FIREBASE_* env vars are NOT present (local scaffold,
 * CI, or a fresh checkout), this module exports `undefined` for auth/db/
 * storage instead of throwing. UI code must use isFirebaseConfigured() and
 * handle the unconfigured state gracefully.
 */
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

let app: FirebaseApp | undefined;

if (apiKey) {
  app =
    getApps().length > 0
      ? getApps()[0]!
      : initializeApp({
          apiKey,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        });
}

export const firebaseApp: FirebaseApp | undefined = app;

/** Firebase Auth instance, or undefined when env keys are missing. */
export const auth: Auth | undefined = app ? getAuth(app) : undefined;

/** Firestore instance, or undefined when env keys are missing. */
export const db: Firestore | undefined = app ? getFirestore(app) : undefined;

/** Cloud Storage instance, or undefined when env keys are missing. */
export const storage: FirebaseStorage | undefined = app ? getStorage(app) : undefined;

/** True when the client SDK was initialized with real env keys. */
export function isFirebaseConfigured(): boolean {
  return app !== undefined;
}
