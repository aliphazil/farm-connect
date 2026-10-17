/**
 * Shared Firebase Admin setup for command-line scripts. Uses the same
 * environment variables as the app (loaded from .env.local by the npm script),
 * Application Default Credentials, or the emulators when *_EMULATOR_HOST is set.
 * Never prints credential values.
 */
import {
  applicationDefault,
  cert,
  initializeApp,
  type App,
} from "firebase-admin/app";

export const usingEmulators = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.FIREBASE_AUTH_EMULATOR_HOST,
);

export function initAdmin(): { app: App; projectId: string } {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    (usingEmulators ? "demo-farmconnect" : "");
  if (!projectId) {
    fail(
      "No Firebase project configured. Set FIREBASE_ADMIN_PROJECT_ID in .env.local (see docs/firebase-setup.md).",
    );
  }
  if (projectId.startsWith("demo-") && !usingEmulators) {
    fail(
      `"${projectId}" is an emulator-only project. Start the emulators or configure a real project.`,
    );
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );
  const credential =
    clientEmail && privateKey
      ? cert({ projectId, clientEmail, privateKey })
      : usingEmulators
        ? undefined
        : applicationDefault();

  return {
    app: initializeApp(credential ? { projectId, credential } : { projectId }),
    projectId,
  };
}

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

export const BOOTSTRAP_ACTOR = "bootstrap-script";
