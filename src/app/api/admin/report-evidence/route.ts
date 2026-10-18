import { COLLECTIONS, UPLOAD_LIMITS } from "@shared/firestore-paths";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { AuthorizationError, assertAdminPermission } from "@/lib/auth/session";

/**
 * Streams one evidence file of a report to an administrator. Files are
 * served with nosniff and a sandboxing CSP so an uploaded file can't run
 * script in the site's origin.
 */
export async function GET(request: Request) {
  try {
    await assertAdminPermission("reports.manage");
  } catch (error) {
    if (error instanceof AuthorizationError)
      return new Response("Forbidden", { status: 403 });
    throw error;
  }
  const url = new URL(request.url);
  const reportId = url.searchParams.get("report") ?? "";
  const index = Number(url.searchParams.get("i"));
  if (!/^[A-Za-z0-9]{1,128}$/.test(reportId) || !Number.isInteger(index))
    return new Response("Bad request", { status: 400 });

  const report = await getAdminDb()
    .collection(COLLECTIONS.reports)
    .doc(reportId)
    .get();
  const paths = (report.get("evidencePaths") as string[] | undefined) ?? [];
  const path = paths[index];
  if (!report.exists || !path)
    return new Response("Not found", { status: 404 });

  const file = getAdminStorage().bucket().file(path);
  const [meta] = await file.getMetadata();
  const type = String(meta.contentType);
  if (!(UPLOAD_LIMITS.evidenceTypes as readonly string[]).includes(type))
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
