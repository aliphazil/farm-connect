import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";
import { getFirebaseWebConfig, firebaseEmulatorsEnabled } from "./config";

/**
 * Browser Firebase SDK. Initialised lazily on first use so pages that don't
 * touch Firebase never load or configure it.
 */
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

export function getFirebaseApp(): FirebaseApp {
  app ??= getApps().length ? getApp() : initializeApp(getFirebaseWebConfig());
  return app;
}

/**
 * Uses the SDK's default persistence for the web: the signed-in state is kept
 * in IndexedDB and survives reloads and browser restarts until sign-out.
 */
export function getClientAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (firebaseEmulatorsEnabled) {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
  }
  return auth;
}

export function getClientDb(): Firestore {
  if (!db) {
    // Optional fields may be undefined in domain objects; drop them on write.
    db = initializeFirestore(getFirebaseApp(), {
      ignoreUndefinedProperties: true,
    });
    if (firebaseEmulatorsEnabled)
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return db;
}

export function getClientStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
    if (firebaseEmulatorsEnabled)
      connectStorageEmulator(storage, "127.0.0.1", 9199);
  }
  return storage;
}
