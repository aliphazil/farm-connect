import "server-only";

import { NextResponse } from "next/server";

/**
 * Rejects cross-site requests to cookie-setting/cookie-authenticated
 * endpoints (CSRF defence in addition to SameSite=Lax cookies).
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function jsonError(code: string, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** Maps Admin SDK auth errors to stable API error codes. */
export function authErrorCode(error: unknown): {
  code: string;
  status: number;
} {
  const code = (error as { code?: string })?.code ?? "";
  if (code === "auth/user-disabled")
    return { code: "account_blocked", status: 403 };
  if (code === "auth/id-token-revoked" || code === "auth/id-token-expired") {
    return { code: "session_expired", status: 401 };
  }
  if (code.startsWith("auth/")) return { code: "invalid_token", status: 401 };
  if (error instanceof Error && error.message.includes("credential")) {
    return { code: "not_configured", status: 503 };
  }
  return { code: "server_error", status: 500 };
}
