import { z } from "zod";

/**
 * Public Firebase web config. These values are shipped to the browser by
 * design; access is controlled by Security Rules, not by keeping them secret.
 *
 * Each variable is referenced literally so Next.js can inline it at build time.
 */
const rawConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const ENV_NAMES: Record<keyof typeof rawConfig, string> = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
};

const firebaseConfigSchema = z.object({
  apiKey: z.string().min(1),
  authDomain: z.string().min(1),
  projectId: z.string().min(1),
  storageBucket: z.string().min(1),
  messagingSenderId: z.string().min(1),
  appId: z.string().min(1),
});
export type FirebaseWebConfig = z.infer<typeof firebaseConfigSchema>;

export const firebaseEmulatorsEnabled =
  process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";

/** Throws a message naming missing variables (never their values). */
export function getFirebaseWebConfig(): FirebaseWebConfig {
  const parsed = firebaseConfigSchema.safeParse(rawConfig);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => ENV_NAMES[issue.path[0] as keyof typeof rawConfig])
      .join(", ");
    throw new Error(
      `Firebase is not configured. Set ${missing} in .env.local (see .env.example).`,
    );
  }
  return parsed.data;
}
