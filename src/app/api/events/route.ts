import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { isRole } from "@shared/constants/roles";
import { analyticsBatchSchema } from "@shared/schemas";
import { getAdminAuth } from "@/lib/firebase/admin";
import { isSameOrigin, jsonError } from "@/lib/auth/http";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { perAddress, perVisitor } from "@/lib/analytics-limits";
import { recordEvents, type Viewer } from "@/services/server/analytics";

/**
 * Marketplace analytics intake (definitions: shared/schemas/analytics.ts).
 * Same-origin only, small validated batches, rate-limited per network
 * address and per browser, bots ignored. Nothing here returns data.
 */

const MAX_BODY = 4096;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|lighthouse|preview/i;

const enabled = () => process.env.CATALOG_SOURCE === "firestore";

/** The signed-in viewer, if any, only to leave out admins and own listings. */
async function viewerOf(request: Request): Promise<Viewer> {
  const cookie = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
  if (!cookie) return null;
  try {
    // No revocation check: this only decides what not to count.
    const token = await getAdminAuth().verifySessionCookie(
      decodeURIComponent(cookie),
      false,
    );
    return { uid: token.uid, role: isRole(token.role) ? token.role : null };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError("forbidden_origin", 403);
  if (!enabled()) return new NextResponse(null, { status: 204 });
  if (BOT.test(request.headers.get("user-agent") ?? ""))
    return new NextResponse(null, { status: 204 });

  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  // Hashed so raw addresses aren't even kept in memory.
  const addressKey = createHash("sha256").update(address).digest("base64url");
  if (!perAddress.take(addressKey)) return jsonError("rate_limited", 429);

  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY) return jsonError("invalid_request", 400);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return jsonError("invalid_request", 400);
  }
  const batch = analyticsBatchSchema.safeParse(json);
  if (!batch.success) return jsonError("invalid_request", 400);
  if (!perVisitor.take(batch.data.v)) return jsonError("rate_limited", 429);

  try {
    const result = await recordEvents(batch.data, {
      now: new Date(),
      viewer: await viewerOf(request),
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Analytics intake failed", error);
    return jsonError("server_error", 500);
  }
}
