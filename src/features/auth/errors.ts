/**
 * Maps Firebase client errors and our API error codes to keys in the
 * `authErrors` dictionary, so users see friendly messages in their language.
 * Unknown errors fall back to a generic message (details go to the console).
 */
export const AUTH_ERROR_KEYS = [
  "invalidCredentials",
  "invalidEmail",
  "accountBlocked",
  "accountSuspended",
  "emailInUse",
  "weakPassword",
  "tooManyRequests",
  "network",
  "notConfigured",
  "alreadyRegistered",
  "invalidProfile",
  "sessionExpired",
  "generic",
] as const;
export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

const BY_CODE: Record<string, AuthErrorKey> = {
  // Firebase Auth (client SDK)
  "auth/invalid-credential": "invalidCredentials",
  "auth/wrong-password": "invalidCredentials",
  "auth/user-not-found": "invalidCredentials",
  "auth/invalid-login-credentials": "invalidCredentials",
  "auth/missing-password": "invalidCredentials",
  "auth/invalid-email": "invalidEmail",
  "auth/missing-email": "invalidEmail",
  "auth/user-disabled": "accountBlocked",
  "auth/email-already-in-use": "emailInUse",
  "auth/weak-password": "weakPassword",
  "auth/password-does-not-meet-requirements": "weakPassword",
  "auth/too-many-requests": "tooManyRequests",
  "auth/network-request-failed": "network",
  "auth/invalid-api-key": "notConfigured",
  "auth/configuration-not-found": "notConfigured",
  // Our API (src/app/api/auth/*)
  account_blocked: "accountBlocked",
  account_suspended: "accountSuspended",
  already_registered: "alreadyRegistered",
  invalid_input: "invalidProfile",
  recent_login_required: "sessionExpired",
  session_expired: "sessionExpired",
  invalid_token: "sessionExpired",
  not_configured: "notConfigured",
};

export class AuthFlowError extends Error {
  constructor(
    public readonly code: string,
    cause?: unknown,
  ) {
    super(code, { cause });
    this.name = "AuthFlowError";
  }
}

export function authErrorKey(error: unknown): AuthErrorKey {
  const code = (error as { code?: unknown })?.code;
  if (typeof code === "string" && code in BY_CODE) return BY_CODE[code];
  if (
    error instanceof Error &&
    error.message.startsWith("Firebase is not configured")
  ) {
    return "notConfigured";
  }
  if (error instanceof TypeError) return "network"; // fetch failed
  return "generic";
}
