/**
 * Firebase Admin SDK — null-safe initialization (server only).
 *
 * Requires FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL and
 * FIREBASE_ADMIN_PRIVATE_KEY. If any are missing, adminAuth/adminDb are
 * undefined and server code must return a clean 503/redirect instead of
 * crashing. Never import this module from client components.
 */
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

let adminApp: App | undefined;

if (projectId && clientEmail && privateKey) {
  adminApp =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          projectId,
        });
}

/** Admin Auth, or undefined when admin env keys are missing. */
export const adminAuth: Auth | undefined = adminApp ? getAuth(adminApp) : undefined;

/** Admin Firestore, or undefined when admin env keys are missing. */
export const adminDb: Firestore | undefined = adminApp ? getFirestore(adminApp) : undefined;

/** True when the Admin SDK was initialized with real credentials. */
export function isAdminConfigured(): boolean {
  return adminApp !== undefined;
}
