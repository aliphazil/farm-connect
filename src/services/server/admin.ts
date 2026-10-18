import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import {
  ACCOUNT_RESTRICTIONS,
  SUSPENSION_DAYS,
  SYSTEM_ACTOR,
  adminCan,
  type AccountRestriction,
  type AdminLevel,
  type AdminPermission,
} from "@shared/constants/admin";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@shared/constants/catalog";
import { ATOLL_CODES } from "@shared/constants/geography";
import type { SelfServiceRole } from "@shared/constants/roles";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";
import { dictionaries } from "@shared/i18n";
import { islandIdFor } from "@shared/island-id";
import {
  REPORT_OUTCOMES,
  REPORT_REASONS,
  REPORT_STATUSES,
  brandingInputSchema,
  islandInputSchema,
  isFarmPublic,
  isProductPublic,
  referenceLabelInputSchema,
  type BrandingInput,
  type FarmerApprovalStatus,
  type IslandInput,
  type ModerationActionType,
  type PaymentVerification,
  type ProductModeration,
  type ReferenceLabelInput,
  type ReportStatus,
  type ReportOutcome,
  type ReportReason,
  type EnforcementType,
  type EnforcementStatus,
} from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { addAdminLog, addModerationAction, col, serverNow } from "./db";
import { releaseGuard } from "./reports";

/**
 * Privileged operations. Callers MUST pass an actor obtained from a verified
 * session (assertAdminPermission(...) in a Server Action). Each function
 * re-checks the actor's permission as defence in depth, writes an adminLogs
 * entry and, where relevant, a moderationActions entry.
 *
 * No function here grants or changes admin privileges: that's only possible
 * with scripts/grant-admin.mts and Admin SDK credentials.
 */

export type Actor = {
  uid: string;
  role: string | null;
  adminLevel?: AdminLevel;
};

export type AdminErrorCode =
  | "forbidden"
  | "not_found"
  | "invalid_input"
  | "invalid_state"
  | "cannot_target_self"
  | "cannot_target_admin"
  | "already_exists"
  | "in_use"
  | "limit_reached"
  | "hold_not_allowed"
  | "no_reported_user";

export class AdminOperationError extends Error {
  constructor(public readonly code: AdminErrorCode) {
    super(code);
    this.name = "AdminOperationError";
  }
}

function assertCan(actor: Actor, permission: AdminPermission) {
  if (actor.role !== "admin" || !adminCan(actor.adminLevel, permission))
    throw new AdminOperationError("forbidden");
}

function cleanReason(reason: string | undefined, min = 3, max = 500) {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length < min || trimmed.length > max)
    throw new AdminOperationError("invalid_input");
  return trimmed;
}

const BATCH_LIMIT = 400;

/**
 * Sets products.farmerVisible for every product of a farmer and recomputes
 * the derived isPublic flag used by public queries.
 */
async function syncFarmerVisibility(farmerId: string, visible: boolean) {
  const snap = await col(COLLECTIONS.products)
    .where("farmerId", "==", farmerId)
    .get();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = getAdminDb().batch();
    for (const doc of snap.docs.slice(i, i + BATCH_LIMIT)) {
      batch.update(doc.ref, {
        farmerVisible: visible,
        isPublic: isProductPublic({
          status: doc.get("status"),
          moderation: doc.get("moderation"),
          farmerVisible: visible,
        }),
        updatedAt: serverNow(),
      });
    }
    await batch.commit();
  }
}

/** A member account (never an administrator — those are managed by script). */
async function loadTarget(uid: string) {
  const auth = getAdminAuth();
  const [authUser, userSnap] = await Promise.all([
    auth.getUser(uid).catch(() => null),
    col(COLLECTIONS.users).doc(uid).get(),
  ]);
  if (!authUser || !userSnap.exists) throw new AdminOperationError("not_found");
  if (
    authUser.customClaims?.role === "admin" ||
    userSnap.get("role") === "admin"
  )
    throw new AdminOperationError("cannot_target_admin");
  return {
    authUser,
    role: userSnap.get("role") as string,
    status: (userSnap.get("status") as string) ?? "active",
  };
}

function assertNotSelf(actor: Actor, uid: string) {
  if (actor.uid === uid) throw new AdminOperationError("cannot_target_self");
}

// ---------------------------------------------------------------------------
// Account enforcement: warn, restrict, suspend, block, restore, appeals
// ---------------------------------------------------------------------------

/** Extra context for an enforcement action. */
export type EnforcementOptions = {
  /** The report this action came from. */
  reportId?: string;
  /** Admin-only note (never shown to the user). */
  internalNote?: string;
  /**
   * Pause the user's appeal while an investigation runs, with a reason the
   * user sees. Only when the platform policy allows it.
   */
  holdAppeal?: string;
};

type Batchish = {
  set(
    ref: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData,
  ): unknown;
};

async function appealPolicy() {
  const snap = await col(COLLECTIONS.siteSettings)
    .doc(SITE_SETTINGS_DOCS.moderation)
    .get();
  return {
    appealsEnabled: snap.get("appealsEnabled") !== false,
    allowAppealHold: snap.get("allowAppealHold") === true,
  };
}

/** Validates options; returns the appeal block for a new action. */
async function appealFields(opts: EnforcementOptions) {
  const hold = opts.holdAppeal?.trim();
  if (!hold) return { status: "none" };
  if (hold.length < 3 || hold.length > 500)
    throw new AdminOperationError("invalid_input");
  if (!(await appealPolicy()).allowAppealHold)
    throw new AdminOperationError("hold_not_allowed");
  return { status: "none", heldUntilDecision: true, heldReason: hold };
}

/** Writes an enforcementActions record inside the caller's batch. Returns its id. */
function recordEnforcement(
  batch: Batchish,
  entry: {
    userId: string;
    type: EnforcementType;
    reason: string;
    createdBy: string;
    restrictions?: AccountRestriction[];
    expiresAt?: Date;
    appeal: Record<string, unknown>;
    opts: EnforcementOptions;
  },
): string {
  const ref = col(COLLECTIONS.enforcementActions).doc();
  batch.set(ref, {
    userId: entry.userId,
    type: entry.type,
    reason: entry.reason,
    ...(entry.opts.internalNote?.trim()
      ? { internalNote: entry.opts.internalNote.trim().slice(0, 2000) }
      : {}),
    ...(entry.restrictions ? { restrictions: entry.restrictions } : {}),
    ...(entry.opts.reportId ? { reportId: entry.opts.reportId } : {}),
    ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
    createdBy: entry.createdBy,
    createdAt: serverNow(),
    status: "active",
    appeal: entry.appeal,
  });
  return ref.id;
}

/** Ends the user's active actions of the given types (lifted, expired or overturned). */
async function endActiveActions(
  batch: {
    update(
      ref: FirebaseFirestore.DocumentReference,
      data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>,
    ): unknown;
  },
  userId: string,
  types: EnforcementType[],
  status: Exclude<EnforcementStatus, "active">,
  endedBy: string,
  endReason?: string,
  exceptId?: string,
) {
  const snap = await col(COLLECTIONS.enforcementActions)
    .where("userId", "==", userId)
    .where("status", "==", "active")
    .get();
  for (const doc of snap.docs) {
    if (doc.id === exceptId || !types.includes(doc.get("type"))) continue;
    batch.update(doc.ref, {
      status,
      endedAt: serverNow(),
      endedBy,
      ...(endReason ? { endReason } : {}),
    });
  }
}

/**
 * A warning: recorded and shown to the user in their account notices.
 * Nothing else about the account changes.
 */
export async function warnUser(
  actor: Actor,
  uid: string,
  reason: string,
  opts: EnforcementOptions = {},
): Promise<string> {
  assertCan(actor, "users.moderate");
  assertNotSelf(actor, uid);
  const why = cleanReason(reason, 3, 1000);
  await loadTarget(uid);
  const appeal = await appealFields(opts);
  const batch = getAdminDb().batch();
  const actionId = recordEnforcement(batch, {
    userId: uid,
    type: "warning",
    reason: why,
    createdBy: actor.uid,
    appeal,
    opts,
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.warn",
    targetType: "user",
    targetId: uid,
    reason: why,
    reportId: opts.reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.warn",
    targetType: "user",
    targetId: uid,
    details: {
      actionId,
      ...(opts.reportId ? { reportId: opts.reportId } : {}),
    },
  });
  await batch.commit();
  return actionId;
}

/**
 * Blocks an account indefinitely: revokes sessions, sets the `blocked` claim
 * and users.status = "blocked" (Security Rules then refuse every write, and
 * the session endpoint refuses to sign them in), and hides a farmer's farm
 * and products. Sign-in to Firebase itself stays possible so the person can
 * read the reason and appeal; nothing else works. Records, invoices,
 * payments and reports are kept. Owners only.
 */
export async function blockUser(
  actor: Actor,
  uid: string,
  reason: string,
  opts: EnforcementOptions = {},
): Promise<string> {
  assertCan(actor, "users.block");
  assertNotSelf(actor, uid);
  const why = cleanReason(reason);
  const { authUser, role } = await loadTarget(uid);
  const appeal = await appealFields(opts);
  const auth = getAdminAuth();

  // Auth first: from here existing sessions and refresh tokens stop working.
  const claims: Record<string, unknown> = {
    ...authUser.customClaims,
    blocked: true,
  };
  delete claims.suspendedUntil;
  await auth.setCustomUserClaims(uid, claims);
  await auth.revokeRefreshTokens(uid);

  const batch = getAdminDb().batch();
  batch.update(col(COLLECTIONS.users).doc(uid), {
    status: "blocked",
    blockedReason: why,
    suspendedUntil: FieldValue.delete(),
    updatedAt: serverNow(),
  });
  if (role === "farmer") {
    batch.update(col(COLLECTIONS.farmerProfiles).doc(uid), {
      visible: false,
      updatedAt: serverNow(),
    });
  }
  // A block replaces any suspension in force.
  await endActiveActions(
    batch,
    uid,
    ["suspension"],
    "lifted",
    actor.uid,
    "Replaced by a block",
  );
  const actionId = recordEnforcement(batch, {
    userId: uid,
    type: "block",
    reason: why,
    createdBy: actor.uid,
    appeal,
    opts,
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.block",
    targetType: "user",
    targetId: uid,
    reason: why,
    reportId: opts.reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.block",
    targetType: "user",
    targetId: uid,
    details: { reason: why, actionId },
  });
  await batch.commit();

  if (role === "farmer") await syncFarmerVisibility(uid, false);
  return actionId;
}

/**
 * Suspends an account for `days`. Sessions are revoked and writes stop at
 * once (rules require status "active"); a farmer's farm and products are
 * hidden. The suspension lifts itself at the first sign-in after it ends
 * (liftExpiredSuspension), or an admin lifts it.
 */
export async function suspendUser(
  actor: Actor,
  uid: string,
  days: number,
  reason: string,
  opts: EnforcementOptions = {},
): Promise<Date> {
  assertCan(actor, "users.moderate");
  assertNotSelf(actor, uid);
  if (!(SUSPENSION_DAYS as readonly number[]).includes(days))
    throw new AdminOperationError("invalid_input");
  const why = cleanReason(reason);
  const { authUser, role, status } = await loadTarget(uid);
  if (status === "blocked") throw new AdminOperationError("invalid_state");
  const appeal = await appealFields(opts);
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const auth = getAdminAuth();

  await auth.setCustomUserClaims(uid, {
    ...authUser.customClaims,
    suspendedUntil: until.getTime(),
  });
  await auth.revokeRefreshTokens(uid);

  const batch = getAdminDb().batch();
  batch.update(col(COLLECTIONS.users).doc(uid), {
    status: "suspended",
    blockedReason: why,
    suspendedUntil: until,
    updatedAt: serverNow(),
  });
  if (role === "farmer") {
    batch.update(col(COLLECTIONS.farmerProfiles).doc(uid), {
      visible: false,
      updatedAt: serverNow(),
    });
  }
  await endActiveActions(
    batch,
    uid,
    ["suspension"],
    "lifted",
    actor.uid,
    "Replaced by a new suspension",
  );
  const actionId = recordEnforcement(batch, {
    userId: uid,
    type: "suspension",
    reason: why,
    createdBy: actor.uid,
    expiresAt: until,
    appeal,
    opts,
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.suspend",
    targetType: "user",
    targetId: uid,
    reason: why,
    until,
    reportId: opts.reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.suspend",
    targetType: "user",
    targetId: uid,
    details: { reason: why, days, until: until.toISOString(), actionId },
  });
  await batch.commit();

  if (role === "farmer") await syncFarmerVisibility(uid, false);
  return until;
}

/** Shared by restoreUser, appeal overturns and lifting expired suspensions. */
async function restoreAccount(
  actorId: string,
  uid: string,
  role: string,
  claimsIn: Record<string, unknown> | undefined,
  reason: string | undefined,
  endStatus: Exclude<EnforcementStatus, "active"> = "lifted",
) {
  const auth = getAdminAuth();
  const claims = { ...claimsIn };
  delete claims.blocked;
  delete claims.suspendedUntil;
  await auth.setCustomUserClaims(uid, claims);
  // Older blocks disabled sign-in; make sure it's enabled again.
  await auth.updateUser(uid, { disabled: false });

  const batch = getAdminDb().batch();
  batch.update(col(COLLECTIONS.users).doc(uid), {
    status: "active",
    blockedReason: FieldValue.delete(),
    suspendedUntil: FieldValue.delete(),
    updatedAt: serverNow(),
  });
  let farmPublic = false;
  if (role === "farmer") {
    const farm = await col(COLLECTIONS.farmerProfiles).doc(uid).get();
    if (farm.exists) {
      farmPublic = isFarmPublic({
        approvalStatus: farm.get("approvalStatus"),
        visible: true,
      });
      batch.update(farm.ref, { visible: true, updatedAt: serverNow() });
    }
  }
  await endActiveActions(
    batch,
    uid,
    ["suspension", "block"],
    endStatus,
    actorId,
    reason,
  );
  addModerationAction(batch, {
    actorId,
    action: "user.restore",
    targetType: "user",
    targetId: uid,
    reason,
  });
  addAdminLog(batch, {
    actorId,
    action: "user.restore",
    targetType: "user",
    targetId: uid,
    details: reason ? { reason } : undefined,
  });
  await batch.commit();
  if (role === "farmer") await syncFarmerVisibility(uid, farmPublic);
}

/**
 * Restores a suspended or blocked account. Lifting a suspension needs
 * "users.moderate"; restoring a blocked account needs "users.block".
 */
export async function restoreUser(actor: Actor, uid: string, reason?: string) {
  const { authUser, role, status } = await loadTarget(uid);
  if (status === "active") throw new AdminOperationError("invalid_state");
  assertCan(actor, status === "blocked" ? "users.block" : "users.moderate");
  assertNotSelf(actor, uid);
  await restoreAccount(
    actor.uid,
    uid,
    role,
    authUser.customClaims,
    reason?.trim() || undefined,
  );
}

/** @deprecated kept for older callers; use restoreUser. */
export const unblockUser = restoreUser;

/**
 * Lifts a suspension whose end has passed. Called by the session endpoint
 * when the user signs in, so no scheduler is needed. Returns whether the
 * account is usable afterwards (false if still suspended or blocked).
 */
export async function liftExpiredSuspension(uid: string): Promise<boolean> {
  const snap = await col(COLLECTIONS.users).doc(uid).get();
  if (!snap.exists) return true;
  const status = snap.get("status");
  if (status !== "suspended") return status !== "blocked";
  const until = snap.get("suspendedUntil")?.toDate?.() as Date | undefined;
  if (until && until.getTime() > Date.now()) return false;
  const authUser = await getAdminAuth().getUser(uid);
  await restoreAccount(
    SYSTEM_ACTOR,
    uid,
    snap.get("role"),
    authUser.customClaims,
    "Suspension ended",
    "expired",
  );
  return true;
}

/** Lifts every suspension that has ended (for accounts that haven't signed in since). */
export async function liftAllExpiredSuspensions(actor: Actor): Promise<number> {
  assertCan(actor, "users.moderate");
  const snap = await col(COLLECTIONS.users)
    .where("status", "==", "suspended")
    .where("suspendedUntil", "<=", new Date())
    .limit(100)
    .get();
  for (const doc of snap.docs) await liftExpiredSuspension(doc.id);
  return snap.size;
}

/**
 * Switches individual features off (or back on) for an account. Enforced in
 * Security Rules via `users.restrictions`. The new set replaces earlier
 * restriction records (which are marked lifted).
 */
export async function setRestrictions(
  actor: Actor,
  uid: string,
  restrictions: AccountRestriction[],
  reason: string,
  opts: EnforcementOptions = {},
): Promise<string | undefined> {
  assertCan(actor, "users.moderate");
  assertNotSelf(actor, uid);
  const list = [...new Set(restrictions)];
  if (
    !list.every((r) => (ACCOUNT_RESTRICTIONS as readonly string[]).includes(r))
  )
    throw new AdminOperationError("invalid_input");
  const why = cleanReason(reason, 3, 1000);
  await loadTarget(uid);
  const appeal = list.length ? await appealFields(opts) : null;

  const batch = getAdminDb().batch();
  batch.update(col(COLLECTIONS.users).doc(uid), {
    restrictions: list.length ? list : FieldValue.delete(),
    updatedAt: serverNow(),
  });
  await endActiveActions(batch, uid, ["restriction"], "lifted", actor.uid, why);
  const actionId = appeal
    ? recordEnforcement(batch, {
        userId: uid,
        type: "restriction",
        reason: why,
        restrictions: list,
        createdBy: actor.uid,
        appeal,
        opts,
      })
    : undefined;
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.restrict",
    targetType: "user",
    targetId: uid,
    reason: why,
    restrictions: list,
    reportId: opts.reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.restrict",
    targetType: "user",
    targetId: uid,
    details: {
      restrictions: list,
      reason: why,
      ...(actionId ? { actionId } : {}),
    },
  });
  await batch.commit();
  return actionId;
}

/**
 * Decides a pending appeal. Upholding keeps the action; overturning lifts it
 * (restores the account, removes the restriction, or voids the warning).
 * The permission needed matches the action: blocks need "users.block".
 */
export async function decideAppeal(
  actor: Actor,
  actionId: string,
  outcome: "upheld" | "overturned",
  note: string,
) {
  const ref = col(COLLECTIONS.enforcementActions).doc(actionId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");
  const type = snap.get("type") as EnforcementType;
  assertCan(actor, type === "block" ? "users.block" : "users.moderate");
  const userId = snap.get("userId") as string;
  assertNotSelf(actor, userId);
  if (snap.get("appeal.status") !== "pending")
    throw new AdminOperationError("invalid_state");
  if (outcome !== "upheld" && outcome !== "overturned")
    throw new AdminOperationError("invalid_input");
  const why = cleanReason(note, 3, 1000);

  if (outcome === "overturned" && snap.get("status") === "active") {
    const target = await loadTarget(userId);
    if (type === "suspension" || type === "block") {
      if (target.status !== "active")
        await restoreAccount(
          actor.uid,
          userId,
          target.role,
          target.authUser.customClaims,
          why,
          "overturned",
        );
    } else if (type === "restriction") {
      const removed = (snap.get("restrictions") as string[] | undefined) ?? [];
      const user = await col(COLLECTIONS.users).doc(userId).get();
      const left = (
        (user.get("restrictions") as string[] | undefined) ?? []
      ).filter((r) => !removed.includes(r));
      await col(COLLECTIONS.users)
        .doc(userId)
        .update({
          restrictions: left.length ? left : FieldValue.delete(),
          updatedAt: serverNow(),
        });
    }
  }

  const batch = getAdminDb().batch();
  batch.update(ref, {
    "appeal.status": outcome,
    "appeal.decidedBy": actor.uid,
    "appeal.decidedAt": serverNow(),
    "appeal.outcomeNote": why,
    ...(outcome === "overturned"
      ? {
          status: "overturned",
          endedAt: serverNow(),
          endedBy: actor.uid,
          endReason: why,
        }
      : {}),
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: outcome === "upheld" ? "appeal.uphold" : "appeal.overturn",
    targetType: "user",
    targetId: userId,
    reason: why,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "appeal.decide",
    targetType: "user",
    targetId: userId,
    details: { actionId, type, outcome },
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Farmers and roles
// ---------------------------------------------------------------------------

/** Approve or reject a farm. Approved + visible farms appear publicly. */
export async function setFarmerApproval(
  actor: Actor,
  uid: string,
  status: Exclude<FarmerApprovalStatus, "pending">,
  reason?: string,
) {
  assertCan(actor, "farmers.approve");
  if (status !== "approved" && status !== "rejected")
    throw new AdminOperationError("invalid_input");
  const why = status === "rejected" ? cleanReason(reason) : reason?.trim();
  const ref = col(COLLECTIONS.farmerProfiles).doc(uid);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");

  const batch = getAdminDb().batch();
  batch.update(ref, { approvalStatus: status, updatedAt: serverNow() });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: status === "approved" ? "farmer.approve" : "farmer.reject",
    targetType: "farmer",
    targetId: uid,
    reason: why || undefined,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "farmer.approval",
    targetType: "farmer",
    targetId: uid,
    details: { status, ...(why ? { reason: why } : {}) },
  });
  await batch.commit();

  await syncFarmerVisibility(
    uid,
    isFarmPublic({
      approvalStatus: status,
      visible: snap.get("visible") === true,
    }),
  );
}

/** Switch a member between consumer and farmer. Admin is never assignable here. */
export async function changeRole(
  actor: Actor,
  uid: string,
  role: SelfServiceRole,
) {
  assertCan(actor, "users.role");
  if (role !== "consumer" && role !== "farmer")
    throw new AdminOperationError("invalid_input");
  assertNotSelf(actor, uid);
  const { authUser } = await loadTarget(uid);

  const db = getAdminDb();
  await db.runTransaction(async (tx) => {
    const userRef = col(COLLECTIONS.users).doc(uid);
    const user = await tx.get(userRef);
    const profileRef = col(
      role === "farmer"
        ? COLLECTIONS.farmerProfiles
        : COLLECTIONS.consumerProfiles,
    ).doc(uid);
    const profile = await tx.get(profileRef);
    const now = serverNow();
    if (!profile.exists) {
      if (role === "farmer") {
        const location = user.get("location");
        const phone = user.get("phone");
        if (!location || !phone) throw new AdminOperationError("invalid_input");
        tx.create(profileRef, {
          farmName: { en: user.get("displayName") },
          location,
          contact: { phone },
          pickupAvailable: false,
          deliveryDestinations: [{ atollCode: location.atollCode }],
          approvalStatus: "pending",
          verified: false,
          visible: true,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        tx.create(profileRef, {
          marketingOptIn: false,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    tx.update(userRef, { role, updatedAt: now });
    addAdminLog(tx, {
      actorId: actor.uid,
      action: "user.role_change",
      targetType: "user",
      targetId: uid,
      details: { from: user.get("role"), to: role },
    });
  });

  await getAdminAuth().setCustomUserClaims(uid, {
    ...authUser.customClaims,
    role,
  });
  // Existing sessions keep the old role until they expire, so end them now.
  await getAdminAuth().revokeRefreshTokens(uid);
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** Allowed moderation changes: from → to. */
const MODERATION_MOVES: Record<ProductModeration, ProductModeration[]> = {
  pending: ["ok", "rejected", "removed"],
  rejected: ["ok", "removed"],
  ok: ["removed"],
  removed: ["ok"],
};

function moderationActionFor(
  from: ProductModeration,
  to: ProductModeration,
): ModerationActionType {
  if (to === "removed") return "product.remove";
  if (to === "rejected") return "product.reject";
  return from === "removed" ? "product.restore" : "product.approve";
}

/**
 * Approve (→ ok), reject (→ rejected), remove (→ removed) or restore
 * (removed → ok) a listing. A reason is required for reject and remove and
 * is shown to the farmer.
 */
export async function setProductModeration(
  actor: Actor,
  productId: string,
  moderation: ProductModeration,
  reason: string,
  reportId?: string,
) {
  assertCan(actor, "products.moderate");
  const ref = col(COLLECTIONS.products).doc(productId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");
  const from = snap.get("moderation") as ProductModeration;
  if (!MODERATION_MOVES[from]?.includes(moderation))
    throw new AdminOperationError("invalid_state");
  const needsReason = moderation === "rejected" || moderation === "removed";
  const why = needsReason ? cleanReason(reason) : reason?.trim() || undefined;

  const batch = getAdminDb().batch();
  batch.update(ref, {
    moderation,
    moderationNote: needsReason ? why : FieldValue.delete(),
    isPublic: isProductPublic({
      status: snap.get("status"),
      moderation,
      farmerVisible: snap.get("farmerVisible") === true,
    }),
    updatedAt: serverNow(),
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: moderationActionFor(from, moderation),
    targetType: "product",
    targetId: productId,
    reason: why,
    reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "product.moderation",
    targetType: "product",
    targetId: productId,
    details: { from, to: moderation, ...(why ? { reason: why } : {}) },
  });
  await batch.commit();
}

/**
 * Marks a listing inactive (status "paused"). The farmer can publish it again
 * (unless their listings are restricted); use remove to keep it down.
 */
export async function deactivateProduct(
  actor: Actor,
  productId: string,
  reason: string,
) {
  assertCan(actor, "products.moderate");
  const why = cleanReason(reason);
  const ref = col(COLLECTIONS.products).doc(productId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");
  const from = snap.get("status");
  if (from === "paused" || from === "draft")
    throw new AdminOperationError("invalid_state");

  const batch = getAdminDb().batch();
  batch.update(ref, {
    status: "paused",
    isPublic: false,
    updatedAt: serverNow(),
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "product.deactivate",
    targetType: "product",
    targetId: productId,
    reason: why,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "product.status",
    targetType: "product",
    targetId: productId,
    details: { from, to: "paused", reason: why },
  });
  await batch.commit();
}

const FEATURED_LIMIT = { product: 24, farmer: 12 } as const;

/** Adds or removes a product/farm on the homepage. Only public items can be featured. */
export async function setFeatured(
  actor: Actor,
  targetType: "product" | "farmer",
  targetId: string,
  featured: boolean,
) {
  assertCan(actor, "products.feature");
  const db = getAdminDb();
  const settingsRef = col(COLLECTIONS.siteSettings).doc(
    SITE_SETTINGS_DOCS.featured,
  );
  const field = targetType === "product" ? "productIds" : "farmerIds";

  await db.runTransaction(async (tx) => {
    const settings = await tx.get(settingsRef);
    const current: string[] = settings.get(field) ?? [];
    if (featured) {
      if (current.includes(targetId)) return;
      if (current.length >= FEATURED_LIMIT[targetType])
        throw new AdminOperationError("limit_reached");
      const target = await tx.get(
        col(
          targetType === "product"
            ? COLLECTIONS.products
            : COLLECTIONS.farmerProfiles,
        ).doc(targetId),
      );
      if (!target.exists) throw new AdminOperationError("not_found");
      const isPublic =
        targetType === "product"
          ? target.get("isPublic") === true
          : isFarmPublic({
              approvalStatus: target.get("approvalStatus"),
              visible: target.get("visible") === true,
            });
      if (!isPublic) throw new AdminOperationError("invalid_state");
    } else if (!current.includes(targetId)) return;

    const next = featured
      ? [targetId, ...current]
      : current.filter((id) => id !== targetId);
    tx.set(
      settingsRef,
      {
        productIds: settings.get("productIds") ?? [],
        farmerIds: settings.get("farmerIds") ?? [],
        [field]: next,
        updatedAt: serverNow(),
        updatedBy: actor.uid,
      },
      { merge: true },
    );
    addAdminLog(tx, {
      actorId: actor.uid,
      action: "featured.update",
      targetType,
      targetId,
      details: { featured },
    });
  });
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

async function loadReport(reportId: string) {
  const ref = col(COLLECTIONS.reports).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");
  return { ref, snap };
}

const reportKey = (snap: FirebaseFirestore.DocumentSnapshot) => ({
  reporterId: snap.get("reporterId") as string,
  targetType: snap.get("targetType") as string,
  targetId: snap.get("targetId") as string,
});

const isClosed = (status: string) =>
  status === "resolved" || status === "dismissed";

/**
 * Moves a report between review states (start review, reopen) or closes it
 * with an outcome note. Prefer decideReport for closing with a decision.
 */
export async function updateReport(
  actor: Actor,
  reportId: string,
  status: ReportStatus,
  resolution?: string,
) {
  assertCan(actor, "reports.manage");
  if (!(REPORT_STATUSES as readonly string[]).includes(status))
    throw new AdminOperationError("invalid_input");
  const closing = isClosed(status);
  const note = closing
    ? cleanReason(resolution, 3, 2000)
    : resolution?.trim() || undefined;
  const { ref, snap } = await loadReport(reportId);
  const from = snap.get("status") as string;
  if (from === status && !note) throw new AdminOperationError("invalid_state");

  const batch = getAdminDb().batch();
  batch.update(ref, {
    status,
    ...(note ? { resolution: note } : {}),
    ...(closing
      ? { handledBy: actor.uid, closedAt: serverNow(), outcome: "no_action" }
      : { closedAt: FieldValue.delete() }),
    updatedAt: serverNow(),
  });
  // Closing releases the duplicate guard; reopening takes it again.
  if (!snap.get("internal") && closing !== isClosed(from))
    releaseGuard(batch, reportKey(snap), !closing);
  addModerationAction(batch, {
    actorId: actor.uid,
    action:
      status === "resolved"
        ? "report.resolve"
        : status === "dismissed"
          ? "report.dismiss"
          : "report.review",
    targetType: "report",
    targetId: reportId,
    reason: note,
    reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "report.update",
    targetType: "report",
    targetId: reportId,
    details: { from, to: status },
  });
  await batch.commit();
}

/** Assigns a report to an administrator (or unassigns it with null). */
export async function assignReport(
  actor: Actor,
  reportId: string,
  assigneeId: string | null,
) {
  assertCan(actor, "reports.manage");
  const { ref } = await loadReport(reportId);
  if (assigneeId) {
    const [authUser, user] = await Promise.all([
      getAdminAuth()
        .getUser(assigneeId)
        .catch(() => null),
      col(COLLECTIONS.users).doc(assigneeId).get(),
    ]);
    if (
      authUser?.customClaims?.role !== "admin" ||
      user.get("role") !== "admin"
    )
      throw new AdminOperationError("invalid_input");
  }
  const batch = getAdminDb().batch();
  batch.update(ref, {
    assigneeId: assigneeId ?? null,
    updatedAt: serverNow(),
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "report.assign",
    targetType: "report",
    targetId: reportId,
    reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "report.assign",
    targetType: "report",
    targetId: reportId,
    details: { assigneeId: assigneeId ?? null },
  });
  await batch.commit();
}

/** A private note on a report: admins only, never the reporter or the reported party. */
export async function addReportNote(
  actor: Actor,
  reportId: string,
  body: string,
) {
  assertCan(actor, "reports.manage");
  const text = cleanReason(body, 1, 4000);
  const { ref } = await loadReport(reportId);
  const batch = getAdminDb().batch();
  batch.set(ref.collection("notes").doc(), {
    authorId: actor.uid,
    body: text,
    createdAt: serverNow(),
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "report.note",
    targetType: "report",
    targetId: reportId,
  });
  await batch.commit();
}

/** Asks the reporter for more information; the report waits for their reply. */
export async function requestReportInfo(
  actor: Actor,
  reportId: string,
  question: string,
) {
  assertCan(actor, "reports.manage");
  const text = cleanReason(question, 3, 2000);
  const { ref, snap } = await loadReport(reportId);
  if (isClosed(snap.get("status")) || snap.get("internal"))
    throw new AdminOperationError("invalid_state");
  const batch = getAdminDb().batch();
  batch.set(ref.collection("messages").doc(), {
    author: "admin",
    authorId: actor.uid,
    body: text,
    createdAt: serverNow(),
  });
  batch.update(ref, { status: "awaiting_info", updatedAt: serverNow() });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "report.request_info",
    targetType: "report",
    targetId: reportId,
    reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "report.request_info",
    targetType: "report",
    targetId: reportId,
  });
  await batch.commit();
}

export type ReportDecision = {
  close: "resolved" | "dismissed";
  /** Note shown to the reporter. */
  resolution: string;
  outcome: ReportOutcome;
  /** For account outcomes: the reason shown to the reported account. */
  userReason?: string;
  days?: number;
  restrictions?: AccountRestriction[];
  internalNote?: string;
  holdAppeal?: string;
};

/**
 * Records the decision on a report and closes it. Account outcomes are
 * applied to the reported account (and need the matching permission:
 * blocking needs an owner); "listing_removed" removes the reported listing.
 */
export async function decideReport(
  actor: Actor,
  reportId: string,
  decision: ReportDecision,
): Promise<string | undefined> {
  assertCan(actor, "reports.manage");
  const { ref, snap } = await loadReport(reportId);
  if (isClosed(snap.get("status")))
    throw new AdminOperationError("invalid_state");
  if (!(REPORT_OUTCOMES as readonly string[]).includes(decision.outcome))
    throw new AdminOperationError("invalid_input");
  if (decision.close === "dismissed" && decision.outcome !== "no_action")
    throw new AdminOperationError("invalid_input");
  const resolution = cleanReason(decision.resolution, 3, 2000);
  const reportedUserId = snap.get("reportedUserId") as string | undefined;
  const productId = snap.get("productId") as string | undefined;
  const opts: EnforcementOptions = {
    reportId,
    internalNote: decision.internalNote,
    holdAppeal: decision.holdAppeal,
  };
  const accountOutcome = [
    "warning",
    "restriction",
    "suspension",
    "block",
  ].includes(decision.outcome);
  if (accountOutcome && !reportedUserId)
    throw new AdminOperationError("no_reported_user");
  if (decision.outcome === "listing_removed" && !productId)
    throw new AdminOperationError("invalid_input");

  let actionId: string | undefined;
  const reason = decision.userReason ?? "";
  switch (decision.outcome) {
    case "warning":
      actionId = await warnUser(actor, reportedUserId!, reason, opts);
      break;
    case "restriction": {
      const user = await col(COLLECTIONS.users).doc(reportedUserId!).get();
      const current =
        (user.get("restrictions") as AccountRestriction[] | undefined) ?? [];
      const add = decision.restrictions ?? [];
      if (!add.length) throw new AdminOperationError("invalid_input");
      actionId = await setRestrictions(
        actor,
        reportedUserId!,
        [...current, ...add],
        reason,
        opts,
      );
      break;
    }
    case "suspension":
      await suspendUser(
        actor,
        reportedUserId!,
        decision.days ?? 0,
        reason,
        opts,
      );
      actionId = (
        await col(COLLECTIONS.enforcementActions)
          .where("userId", "==", reportedUserId)
          .where("status", "==", "active")
          .where("type", "==", "suspension")
          .limit(1)
          .get()
      ).docs[0]?.id;
      break;
    case "block":
      actionId = await blockUser(actor, reportedUserId!, reason, opts);
      break;
    case "listing_removed":
      await setProductModeration(
        actor,
        productId!,
        "removed",
        reason || resolution,
        reportId,
      );
      break;
  }

  const batch = getAdminDb().batch();
  batch.update(ref, {
    status: decision.close,
    resolution,
    outcome: decision.outcome,
    ...(actionId ? { enforcementActionId: actionId } : {}),
    handledBy: actor.uid,
    closedAt: serverNow(),
    updatedAt: serverNow(),
  });
  if (!snap.get("internal")) releaseGuard(batch, reportKey(snap), false);
  addModerationAction(batch, {
    actorId: actor.uid,
    action: decision.close === "resolved" ? "report.resolve" : "report.dismiss",
    targetType: "report",
    targetId: reportId,
    reason: resolution,
    reportId,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "report.decision",
    targetType: "report",
    targetId: reportId,
    details: {
      close: decision.close,
      outcome: decision.outcome,
      ...(actionId ? { actionId } : {}),
      ...(reportedUserId ? { reportedUserId } : {}),
    },
  });
  await batch.commit();
  return actionId;
}

/**
 * An internal moderation record: a report an administrator opens about an
 * account or listing they noticed themselves. It joins the reports queue.
 */
export async function createInternalReport(
  actor: Actor,
  input: {
    targetType: "user" | "product";
    targetId: string;
    reason: ReportReason;
    details: string;
  },
): Promise<string> {
  assertCan(actor, "reports.manage");
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason))
    throw new AdminOperationError("invalid_input");
  const details = cleanReason(input.details, 10, 2000);
  let reportedUserId: string;
  let productId: string | undefined;
  if (input.targetType === "product") {
    const p = await col(COLLECTIONS.products).doc(input.targetId).get();
    if (!p.exists) throw new AdminOperationError("not_found");
    reportedUserId = p.get("farmerId");
    productId = input.targetId;
  } else if (input.targetType === "user") {
    await loadTarget(input.targetId);
    reportedUserId = input.targetId;
  } else throw new AdminOperationError("invalid_input");

  const ref = col(COLLECTIONS.reports).doc();
  const batch = getAdminDb().batch();
  batch.set(ref, {
    reporterId: actor.uid,
    reporterRole: "admin",
    internal: true,
    targetType: input.targetType,
    targetId: input.targetId,
    reportedUserId,
    ...(productId ? { productId } : {}),
    reason: input.reason,
    details,
    status: "open",
    assigneeId: actor.uid,
    createdAt: serverNow(),
    updatedAt: serverNow(),
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "report.create",
    targetType: "report",
    targetId: ref.id,
    details: { internal: true, reportedUserId, reason: input.reason },
  });
  await batch.commit();
  return ref.id;
}

// ---------------------------------------------------------------------------
// Payments, branding and settings
// ---------------------------------------------------------------------------

export async function verifyPayment(
  actor: Actor,
  paymentId: string,
  status: Exclude<PaymentVerification, "unverified">,
) {
  assertCan(actor, "payments.verify");
  const ref = col(COLLECTIONS.payments).doc(paymentId);
  if (!(await ref.get()).exists) throw new AdminOperationError("not_found");
  const batch = getAdminDb().batch();
  batch.update(ref, {
    verificationStatus: status,
    verifiedBy: actor.uid,
    verifiedAt: serverNow(),
    updatedAt: serverNow(),
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "payment.verification",
    targetType: "payment",
    targetId: paymentId,
    details: { status },
  });
  await batch.commit();
}

export async function publishBranding(actor: Actor, input: BrandingInput) {
  assertCan(actor, "settings.manage");
  const parsed = brandingInputSchema.safeParse(input);
  if (!parsed.success) throw new AdminOperationError("invalid_input");
  const batch = getAdminDb().batch();
  batch.set(col(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCS.branding), {
    ...parsed.data,
    updatedAt: serverNow(),
    updatedBy: actor.uid,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "branding.publish",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.branding,
  });
  await batch.commit();
}

/** Turns listing pre-approval on or off. Applies to listings created afterwards. */
export async function setModerationSettings(
  actor: Actor,
  input: { listingsRequireApproval: boolean },
) {
  assertCan(actor, "settings.manage");
  if (typeof input.listingsRequireApproval !== "boolean")
    throw new AdminOperationError("invalid_input");
  const batch = getAdminDb().batch();
  batch.set(
    col(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCS.moderation),
    {
      listingsRequireApproval: input.listingsRequireApproval,
      updatedAt: serverNow(),
      updatedBy: actor.uid,
    },
    { merge: true },
  );
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "settings.update",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.moderation,
    details: { listingsRequireApproval: input.listingsRequireApproval },
  });
  await batch.commit();
}

/** Appeal policy: whether appeals are open, and whether admins may pause one during an investigation. */
export async function setAppealSettings(
  actor: Actor,
  input: { appealsEnabled?: boolean; allowAppealHold?: boolean },
) {
  assertCan(actor, "settings.manage");
  const update: Record<string, boolean> = {};
  for (const key of ["appealsEnabled", "allowAppealHold"] as const) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "boolean")
      throw new AdminOperationError("invalid_input");
    update[key] = input[key];
  }
  if (!Object.keys(update).length)
    throw new AdminOperationError("invalid_input");
  const batch = getAdminDb().batch();
  batch.set(
    col(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCS.moderation),
    { ...update, updatedAt: serverNow(), updatedBy: actor.uid },
    { merge: true },
  );
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "settings.update",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.moderation,
    details: update,
  });
  await batch.commit();
}

// ---------------------------------------------------------------------------
// Reference data: categories, units, islands
// ---------------------------------------------------------------------------

/**
 * Edits a category's or unit's labels and whether it can be chosen for new
 * listings. Ids are fixed in code (rules, schemas, translations), so they
 * can't be added, renamed or deleted here. Blank labels fall back to the
 * built-in translations.
 */
export async function updateReferenceItem(
  actor: Actor,
  kind: "category" | "unit",
  id: string,
  input: ReferenceLabelInput,
) {
  assertCan(actor, "reference.manage");
  const ids: readonly string[] =
    kind === "category" ? PRODUCT_CATEGORIES : PRODUCT_UNITS;
  const index = ids.indexOf(id);
  if (index < 0) throw new AdminOperationError("not_found");
  const parsed = referenceLabelInputSchema.safeParse(input);
  if (!parsed.success) throw new AdminOperationError("invalid_input");
  const section = kind === "category" ? "categories" : "units";
  const defaults = {
    en: (dictionaries.en[section] as Record<string, string>)[id],
    dv: (dictionaries.dv[section] as Record<string, string>)[id],
  };
  const label = {
    en: parsed.data.labelEn || defaults.en,
    dv: parsed.data.labelDv || defaults.dv,
  };
  const collection =
    kind === "category" ? COLLECTIONS.categories : COLLECTIONS.units;
  const batch = getAdminDb().batch();
  batch.set(
    col(collection).doc(id),
    { label, active: parsed.data.active, sortOrder: index },
    { merge: true },
  );
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "reference.update",
    targetType: kind,
    targetId: id,
    details: { label, active: parsed.data.active },
  });
  await batch.commit();
}

/** Where an island id is used. Ids that are referenced can't be deleted or moved. */
export async function islandReferences(islandId: string) {
  const db = getAdminDb();
  const checks: [string, string, string][] = [
    [COLLECTIONS.farmerProfiles, "location.islandId", "farms"],
    [COLLECTIONS.products, "location.islandId", "products"],
    [COLLECTIONS.users, "location.islandId", "users"],
    [
      COLLECTIONS.consumerProfiles,
      "defaultDeliveryLocation.islandId",
      "buyers",
    ],
    [COLLECTIONS.deliveryAreas, "islandId", "deliveryAreas"],
    [COLLECTIONS.enquiries, "deliverTo.islandId", "enquiries"],
  ];
  const counts = await Promise.all(
    checks.map(async ([collection, field]) => {
      const snap = await db
        .collection(collection)
        .where(field, "==", islandId)
        .count()
        .get();
      return snap.data().count;
    }),
  );
  return Object.fromEntries(checks.map(([, , key], i) => [key, counts[i]]));
}

function parseIsland(input: IslandInput) {
  const parsed = islandInputSchema.safeParse(input);
  if (
    !parsed.success ||
    !(ATOLL_CODES as readonly string[]).includes(parsed.data.atollCode)
  )
    throw new AdminOperationError("invalid_input");
  return parsed.data;
}

/** Adds an island. Its id is derived from the atoll and English name, once. */
export async function createIsland(
  actor: Actor,
  input: IslandInput,
): Promise<string> {
  assertCan(actor, "reference.manage");
  const data = parseIsland(input);
  const id = islandIdFor(data.atollCode, data.nameEn);
  if (id.length < 4) throw new AdminOperationError("invalid_input");
  const ref = col(COLLECTIONS.islands).doc(id);
  const batch = getAdminDb().batch();
  batch.create(ref, {
    atollCode: data.atollCode,
    nameEn: data.nameEn,
    ...(data.nameDv ? { nameDv: data.nameDv } : {}),
    active: data.active,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "reference.update",
    targetType: "island",
    targetId: id,
    details: { created: true, atollCode: data.atollCode },
  });
  try {
    await batch.commit();
  } catch (error) {
    if ((error as { code?: number }).code === 6)
      throw new AdminOperationError("already_exists");
    throw error;
  }
  return id;
}

/**
 * Renames or (de)activates an island. The id never changes. Moving it to
 * another atoll is refused while anything refers to it, because records
 * store the atoll alongside the island.
 */
export async function updateIsland(
  actor: Actor,
  islandId: string,
  input: IslandInput,
) {
  assertCan(actor, "reference.manage");
  const data = parseIsland(input);
  const ref = col(COLLECTIONS.islands).doc(islandId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");
  if (snap.get("atollCode") !== data.atollCode) {
    const refs = await islandReferences(islandId);
    if (Object.values(refs).some((n) => n > 0))
      throw new AdminOperationError("in_use");
  }
  const batch = getAdminDb().batch();
  batch.update(ref, {
    atollCode: data.atollCode,
    nameEn: data.nameEn,
    nameDv: data.nameDv ? data.nameDv : FieldValue.delete(),
    active: data.active,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "reference.update",
    targetType: "island",
    targetId: islandId,
    details: {
      atollCode: data.atollCode,
      nameEn: data.nameEn,
      active: data.active,
    },
  });
  await batch.commit();
}

/** Deletes an island nobody refers to (otherwise deactivate it instead). */
export async function deleteIsland(actor: Actor, islandId: string) {
  assertCan(actor, "reference.manage");
  const ref = col(COLLECTIONS.islands).doc(islandId);
  if (!(await ref.get()).exists) throw new AdminOperationError("not_found");
  const refs = await islandReferences(islandId);
  if (Object.values(refs).some((n) => n > 0))
    throw new AdminOperationError("in_use");
  const batch = getAdminDb().batch();
  batch.delete(ref);
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "reference.update",
    targetType: "island",
    targetId: islandId,
    details: { deleted: true },
  });
  await batch.commit();
}
