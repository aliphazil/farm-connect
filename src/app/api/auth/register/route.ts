import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { authErrorCode, jsonError } from "@/lib/auth/http";
import {
  completeRegistration,
  RegistrationError,
} from "@/services/server/registration";

const bodySchema = z.object({
  idToken: z.string().min(20).max(5000),
  // Validated in detail by completeRegistration (registrationSchema).
  profile: z.record(z.string(), z.unknown()),
});

/**
 * POST { idToken, profile } → creates the user's Firestore records and role
 * claim after Firebase Auth sign-up. The uid comes only from the verified ID
 * token. Works for web and (later) the mobile app, which sends no Origin.
 * The client must refresh its ID token afterwards to pick up the role claim.
 */
export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("invalid_request", 400);

  let uid: string;
  let email: string | undefined;
  try {
    const decoded = await getAdminAuth().verifyIdToken(body.data.idToken, true);
    uid = decoded.uid;
    email = decoded.email;
  } catch (error) {
    const { code, status } = authErrorCode(error);
    return jsonError(code, status);
  }

  try {
    const role = await completeRegistration(uid, email, body.data.profile);
    return NextResponse.json({ role });
  } catch (error) {
    if (error instanceof RegistrationError) {
      const status =
        error.code === "invalid_input"
          ? 400
          : error.code === "account_blocked"
            ? 403
            : 409;
      return jsonError(error.code, status);
    }
    const { code, status } = authErrorCode(error);
    return jsonError(code, status);
  }
}
