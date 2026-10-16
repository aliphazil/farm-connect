import "server-only";

import {
  applicationDefault,
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

/**
 * Firebase Admin SDK — bypasses Security Rules, so it must only ever run in
 * trusted server code (Server Components, Server Actions, Route Handlers).
 * `server-only` makes importing this from a Client Component a build error.
 *
 * Credentials, in order of preference:
 *  1. FIREBASE_ADMIN_* env vars (local dev / non-Google hosting)
 *  2. Application Default Credentials (Firebase App Hosting, Cloud Run)
 * With the emulators, the SDK reads *_EMULATOR_HOST env vars by itself.
 */
function initAdminApp(): App {
  if (getApps().length) return getApp();

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (clientEmail && privateKey) {
    if (!projectId)
      throw new Error("Set FIREBASE_ADMIN_PROJECT_ID (see .env.example).");
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
      storageBucket,
    });
  }

  if (
    process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    process.env.FIRESTORE_EMULATOR_HOST
  ) {
    return initializeApp({
      projectId: projectId ?? "demo-farmconnect",
      storageBucket,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId,
    storageBucket,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(initAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(initAdminApp());
}

export function getAdminStorage(): Storage {
  return getStorage(initAdminApp());
}
