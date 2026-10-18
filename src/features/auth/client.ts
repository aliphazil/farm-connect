import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import type { Role } from "@shared/constants/roles";
import type { Locale } from "@shared/constants/locales";
import type { RegistrationInput } from "@shared/schemas";
import { getClientAuth } from "@/lib/firebase/client";
import { AuthFlowError } from "./errors";

/**
 * Browser authentication flows. Firebase Auth handles credentials; our API
 * turns a fresh ID token into an httpOnly session cookie for server-rendered
 * pages, and creates profiles + role claims after sign-up.
 */

type SessionResult = { role: Role | null; needsProfile: boolean };

async function postJson<T>(
  url: string,
  body: unknown,
  method = "POST",
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AuthFlowError(json.error ?? "server_error");
  return json;
}

/** Exchanges the user's current ID token for a server session cookie. */
async function establishSession(
  user: User,
  forceRefresh = false,
): Promise<SessionResult> {
  const idToken = await user.getIdToken(forceRefresh);
  return postJson<SessionResult>("/api/auth/session", { idToken });
}

export async function signIn(
  email: string,
  password: string,
): Promise<SessionResult> {
  const { user } = await signInWithEmailAndPassword(
    getClientAuth(),
    email.trim(),
    password,
  );
  try {
    return await establishSession(user);
  } catch (error) {
    // A blocked or suspended account gets no session, but stays signed in to
    // Firebase in this browser so it can read the reason and appeal
    // (/appeal, which uses an ID token). Otherwise keep browser and server
    // state consistent by signing out.
    const code = (error as { code?: string }).code;
    if (code !== "account_blocked" && code !== "account_suspended")
      await firebaseSignOut(getClientAuth());
    throw error;
  }
}

/**
 * Creates the Firebase account, then the profile and role on the server, then
 * a session. If the profile step fails the account still exists; the user is
 * sent to onboarding to finish (see completeProfile).
 */
export async function register(
  email: string,
  password: string,
  profile: RegistrationInput,
): Promise<SessionResult> {
  const auth = getClientAuth();
  const { user } = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password,
  );
  await updateProfile(user, { displayName: profile.displayName });
  // Best effort: verification isn't required to use the site yet.
  sendEmailVerification(user).catch(() => undefined);
  try {
    return await completeProfile(profile, user);
  } catch (error) {
    // The Firebase account exists but the profile wasn't saved: start a
    // session if possible and let the caller send the user to onboarding.
    await establishSession(user).catch(() => undefined);
    throw new AuthFlowError("profile_incomplete", error);
  }
}

/** Saves the profile for an already signed-in user (registration or onboarding). */
export async function completeProfile(
  profile: RegistrationInput,
  user: User | null = getClientAuth().currentUser,
): Promise<SessionResult> {
  if (!user) throw new AuthFlowError("session_expired");
  const idToken = await user.getIdToken();
  await postJson<{ role: Role }>("/api/auth/register", { idToken, profile });
  // Refresh so the new role claim is in the token used for the session.
  return establishSession(user, true);
}

export async function signOut(): Promise<void> {
  try {
    await postJson("/api/auth/session", undefined, "DELETE");
  } finally {
    await firebaseSignOut(getClientAuth());
  }
}

/**
 * Sends a reset email. Always resolves the same way whether or not the
 * address has an account, so the form can't be used to discover accounts.
 */
export async function requestPasswordReset(
  email: string,
  locale: Locale,
): Promise<void> {
  const auth = getClientAuth();
  auth.languageCode = locale === "dv" ? "dv" : "en";
  try {
    await sendPasswordResetEmail(auth, email.trim(), {
      url: `${window.location.origin}/${locale}/login`,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/user-not-found") return;
    throw error;
  }
}
