import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { storagePaths, UPLOAD_LIMITS } from "@shared/firestore-paths";
import { getClientStorage } from "@/lib/firebase/client";
import { requireUid } from "./firestore";

/**
 * Image uploads to Cloud Storage. Storage rules enforce the same limits
 * (owner, type, size, file name); these checks give friendly errors first.
 */

export type ImageProblem = "type" | "size";

export function checkImage(file: {
  type: string;
  size: number;
}): ImageProblem | null {
  if (!(UPLOAD_LIMITS.imageTypes as readonly string[]).includes(file.type))
    return "type";
  if (file.size > UPLOAD_LIMITS.imageBytes) return "size";
  return null;
}

const MAX_EDGE = 1600;

/**
 * Downscales large photos in the browser (phones often produce 4000px images)
 * to save upload time and data on island connections. Falls back to the
 * original file if the browser can't process it.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  if (
    typeof createImageBitmap !== "function" ||
    typeof document === "undefined"
  )
    return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      ?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Safe, unique object name that matches the Storage rules' pattern. */
function objectName(contentType: string): string {
  const ext =
    contentType === "image/png"
      ? "png"
      : contentType === "image/webp"
        ? "webp"
        : "jpg";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
}

async function upload(path: string, data: Blob): Promise<string> {
  const contentType = data.type || "image/jpeg";
  await uploadBytes(ref(getClientStorage(), path), data, { contentType });
  return path;
}

export async function uploadProductImage(
  productId: string,
  data: Blob,
): Promise<string> {
  const type = data.type || "image/jpeg";
  return upload(
    storagePaths.productImage(await requireUid(), productId, objectName(type)),
    data,
  );
}

export async function uploadFarmLogo(data: Blob): Promise<string> {
  const type = data.type || "image/jpeg";
  return upload(
    storagePaths.farmerLogo(await requireUid(), objectName(type)),
    data,
  );
}

/** Deletes a stored file; a missing file is not an error. */
export async function deleteStoredFile(path: string): Promise<void> {
  try {
    await deleteObject(ref(getClientStorage(), path));
  } catch (error) {
    if ((error as { code?: string }).code !== "storage/object-not-found")
      throw error;
  }
}

/** Report evidence: photos or PDFs (Storage rules enforce the same limits). */
export function checkEvidence(file: {
  type: string;
  size: number;
}): ImageProblem | null {
  if (!(UPLOAD_LIMITS.evidenceTypes as readonly string[]).includes(file.type))
    return "type";
  if (file.size > UPLOAD_LIMITS.evidenceBytes) return "size";
  return null;
}

export async function uploadReportEvidence(file: Blob): Promise<string> {
  const type = file.type;
  const ext =
    type === "application/pdf" ? "pdf" : objectName(type).split(".").pop();
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const path = storagePaths.reportEvidence(await requireUid(), name);
  await uploadBytes(ref(getClientStorage(), path), file, { contentType: type });
  return path;
}

/** A transfer slip for a payment the farmer is about to record. */
export async function uploadPaymentProof(file: Blob): Promise<string> {
  const type = file.type;
  const ext =
    type === "application/pdf" ? "pdf" : objectName(type).split(".").pop();
  const slot = `${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const path = storagePaths.paymentProof(
    await requireUid(),
    slot,
    `slip.${ext}`,
  );
  await uploadBytes(ref(getClientStorage(), path), file, { contentType: type });
  return path;
}

/** Branding Studio image (owner admins; Storage rules enforce type and size). */
export async function uploadBrandingImage(file: Blob): Promise<string> {
  const type = file.type;
  const ext =
    type === "image/png"
      ? "png"
      : type === "image/webp"
        ? "webp"
        : type === "image/x-icon" || type === "image/vnd.microsoft.icon"
          ? "ico"
          : "jpg";
  // Make sure the signed-in user's token is attached (Storage rules check
  // the owner-admin claim); otherwise the upload goes out anonymous.
  await requireUid();
  const path = `branding/uploads/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  await uploadBytes(ref(getClientStorage(), path), file, { contentType: type });
  return path;
}
