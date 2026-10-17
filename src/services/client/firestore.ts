import {
  collection,
  doc,
  serverTimestamp,
  type DocumentSnapshot,
} from "firebase/firestore";
import type { z } from "zod";
import type { CollectionName } from "@shared/firestore-paths";
import { parseDoc } from "@shared/firestore-convert";
import { AuthFlowError } from "@/features/auth/errors";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";

/**
 * Browser-SDK helpers. Everything written from the browser is checked by
 * Security Rules; these helpers only shape and validate data.
 */

export const now = () => serverTimestamp();

export function colRef(name: CollectionName) {
  return collection(getClientDb(), name);
}

export function docRef(name: CollectionName, id: string) {
  return doc(getClientDb(), name, id);
}

/**
 * The signed-in user's uid. After a page load the SDK restores the user
 * asynchronously, so wait for that first. Throws a "session expired" error if
 * the browser has no signed-in user (the UI then asks to sign in again).
 */
export async function requireUid(): Promise<string> {
  const auth = getClientAuth();
  await auth.authStateReady();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new AuthFlowError("session_expired");
  return uid;
}

export function snapToModel<S extends z.ZodType>(
  schema: S,
  snap: DocumentSnapshot,
  idField: "id" | "uid" = "id",
): z.infer<S> | null {
  return snap.exists() ? parseDoc(schema, snap.id, snap.data(), idField) : null;
}
