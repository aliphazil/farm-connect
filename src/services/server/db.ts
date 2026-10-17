import "server-only";

import {
  FieldValue,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
} from "firebase-admin/firestore";
import type { z } from "zod";
import { COLLECTIONS, type CollectionName } from "@shared/firestore-paths";
import { parseDoc } from "@shared/firestore-convert";
import type { AdminLogAction, ModerationActionType } from "@shared/schemas";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Typed Admin-SDK helpers. Admin SDK writes bypass Security Rules, so every
 * caller of these must already have authorised the operation.
 */

export const serverNow = () => FieldValue.serverTimestamp();

export function col(name: CollectionName) {
  return getAdminDb().collection(name);
}

export function snapToModel<S extends z.ZodType>(
  schema: S,
  snap: DocumentSnapshot,
  idField: "id" | "uid" = "id",
): z.infer<S> | null {
  return snap.exists ? parseDoc(schema, snap.id, snap.data(), idField) : null;
}

export async function getModel<S extends z.ZodType>(
  name: CollectionName,
  id: string,
  schema: S,
  idField: "id" | "uid" = "id",
): Promise<z.infer<S> | null> {
  return snapToModel(schema, await col(name).doc(id).get(), idField);
}

/** Actor id for command-line operations (scripts/). */
export const BOOTSTRAP_ACTOR = "bootstrap-script";

/** Anything with a `set` like WriteBatch or Transaction. */
type Batchish = { set(ref: DocumentReference, data: DocumentData): unknown };

/** Appends to adminLogs inside an existing batch or transaction. */
export function addAdminLog(
  batch: Batchish,
  entry: {
    actorId: string;
    action: AdminLogAction;
    targetType: string;
    targetId: string;
    details?: Record<string, unknown>;
  },
) {
  batch.set(col(COLLECTIONS.adminLogs).doc(), {
    ...entry,
    createdAt: serverNow(),
  });
}

/** Appends to moderationActions inside an existing batch or transaction. */
export function addModerationAction(
  batch: Batchish,
  entry: {
    actorId: string;
    action: ModerationActionType;
    targetType: "user" | "farmer" | "product" | "report";
    targetId: string;
    reason?: string;
    reportId?: string;
    until?: Date;
    restrictions?: string[];
  },
) {
  batch.set(col(COLLECTIONS.moderationActions).doc(), {
    ...entry,
    createdAt: serverNow(),
  });
}
