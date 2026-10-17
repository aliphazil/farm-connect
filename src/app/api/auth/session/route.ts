import { NextResponse } from "next/server";
import { z } from "zod";
import { isRole } from "@shared/constants/roles";
import { getAdminAuth } from "@/lib/firebase/admin";
import { liftExpiredSuspension } from "@/services/server/admin";
import { authErrorCode, isSameOrigin, jsonError } from "@/lib/auth/http";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

const bodySchema = z.object({ idToken: z.string().min(20).max(5000) });

/** Sign-in must be recent before we mint a long-lived session cookie. */
const MAX_AUTH_AGE_SECONDS = 5 * 60;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * POST { idToken } → verifies a fresh Firebase ID token (with revocation and
 * disabled-account checks) and sets an httpOnly session cookie.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("forbidden_origin", 403);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("invalid_request", 400);

  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(body.data.idToken, true);
    if (Date.now() / 1000 - decoded.auth_time > MAX_AUTH_AGE_SECONDS) {
      return jsonError("recent_login_required", 401);
    }
    if (decoded.blocked === true) return jsonError("account_blocked", 403);
    // Suspended: refuse while it lasts; once it has ended, lift it here, so
    // suspensions expire without a scheduled job.
    if (typeof decoded.suspendedUntil === "number") {
      const usable = await liftExpiredSuspension(decoded.uid);
      if (!usable) return jsonError("account_suspended", 403);
    }

    const sessionCookie = await auth.createSessionCookie(body.data.idToken, {
      expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
    });
    const role = isRole(decoded.role) ? decoded.role : null;
    const response = NextResponse.json({ role, needsProfile: role === null });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      sessionCookie,
      cookieOptions(SESSION_MAX_AGE_SECONDS),
    );
    return response;
  } catch (error) {
    const { code, status } = authErrorCode(error);
    return jsonError(code, status);
  }
}

/** DELETE → signs out of this browser by clearing the session cookie. */
export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return jsonError("forbidden_origin", 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", cookieOptions(0));
  return response;
}
