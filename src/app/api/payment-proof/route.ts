import { adminCan, adminLevelOf } from "@shared/constants/admin";
import { COLLECTIONS, UPLOAD_LIMITS } from "@shared/firestore-paths";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { getSessionUser } from "@/lib/auth/session";
import { logFinanceView } from "@/services/server/admin";

/**
 * A payment's transfer slip, for the farmer who recorded it or an
 * administrator (logged). Served with nosniff and a sandboxing CSP.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  const paymentId = new URL(request.url).searchParams.get("payment") ?? "";
  if (!/^[A-Za-z0-9]{1,128}$/.test(paymentId))
    return new Response("Bad request", { status: 400 });
  const payment = await getAdminDb()
    .collection(COLLECTIONS.payments)
    .doc(paymentId)
    .get();
  const path = payment.get("proofPath") as string | undefined;
  if (!payment.exists || !path)
    return new Response("Not found", { status: 404 });
  const isOwner = payment.get("farmerId") === user.uid;
  const isAdmin =
    user.role === "admin" &&
    adminCan(adminLevelOf(user.adminLevel), "admin.view");
  if (!isOwner && !isAdmin) return new Response("Not found", { status: 404 });
  if (isAdmin && !isOwner)
    await logFinanceView(
      {
        uid: user.uid,
        role: user.role,
        adminLevel: adminLevelOf(user.adminLevel),
      },
      "payment",
      paymentId,
    );

  const file = getAdminStorage().bucket().file(path);
  const [meta] = await file.getMetadata();
  const type = String(meta.contentType);
  if (!(UPLOAD_LIMITS.proofTypes as readonly string[]).includes(type))
    return new Response("Unsupported file", { status: 415 });
  const [data] = await file.download();
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy":
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
