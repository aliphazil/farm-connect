import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminAuth } from "@/lib/firebase/admin";
import { authErrorCode, isSameOrigin, jsonError } from "@/lib/auth/http";
import {
  AppealError,
  listMyNotices,
  submitAppeal,
} from "@/services/server/appeals";

/**
 * Account notices and appeals, authenticated with a Firebase ID token rather
 * than the session cookie, because suspended and blocked people can't get a
 * session but must still be able to read why and appeal. Only the caller's
 * own notices are returned; nothing else is reachable from here.
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    idToken: z.string().min(20).max(5000),
  }),
  z.object({
    action: z.literal("submit"),
    idToken: z.string().min(20).max(5000),
    actionId: z.string().min(1).max(128),
    message: z.string().max(2000),
  }),
]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("forbidden_origin", 403);
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("invalid_request", 400);

  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(body.data.idToken, true)).uid;
  } catch (error) {
    const { code, status } = authErrorCode(error);
    return jsonError(code, status);
  }

  try {
    if (body.data.action === "list")
      return NextResponse.json(await listMyNotices(uid));
    await submitAppeal(uid, {
      actionId: body.data.actionId,
      message: body.data.message,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AppealError) return jsonError(error.code, 400);
    console.error("Appeals endpoint failed", error);
    return jsonError("server_error", 500);
  }
}
