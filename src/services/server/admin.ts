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
} from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { addAdminLog, addModerationAction, col, serverNow } from "./db";

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
  | "limit_reached";

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
// Account status: block, suspend, restore
// ---------------------------------------------------------------------------

/**
 * Blocks an account indefinitely: disables sign-in, revokes sessions, marks
 * the account blocked in claims and Firestore, and hides a farmer's farm and
 * products. Owners only.
 */
export async function blockUser(actor: Actor, uid: string, reason: string) {
  assertCan(actor, "users.block");
  assertNotSelf(actor, uid);
  const why = cleanReason(reason);
  const { authUser, role } = await loadTarget(uid);
  const auth = getAdminAuth();

  // Auth first: from here the user can't sign in or refresh tokens.
  const claims: Record<string, unknown> = {
    ...authUser.customClaims,
    blocked: true,
  };
  delete claims.suspendedUntil;
  await auth.setCustomUserClaims(uid, claims);
  await auth.updateUser(uid, { disabled: true });
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
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.block",
    targetType: "user",
    targetId: uid,
    reason: why,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.block",
    targetType: "user",
    targetId: uid,
    details: { reason: why },
  });
  await batch.commit();

  if (role === "farmer") await syncFarmerVisibility(uid, false);
}

/**
 * Suspends an account for `days`. Sessions are revoked and writes stop at
 * once (rules require status "active"); a farmer's farm and products are
 * hidden. Sign-in isn't disabled, so the suspension lifts itself at the
 * first sign-in after it ends (liftExpiredSuspension), or an admin lifts it.
 */
export async function suspendUser(
  actor: Actor,
  uid: string,
  days: number,
  reason: string,
) {
  assertCan(actor, "users.moderate");
  assertNotSelf(actor, uid);
  if (!(SUSPENSION_DAYS as readonly number[]).includes(days))
    throw new AdminOperationError("invalid_input");
  const why = cleanReason(reason);
  const { authUser, role, status } = await loadTarget(uid);
  if (status === "blocked") throw new AdminOperationError("invalid_state");
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
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.suspend",
    targetType: "user",
    targetId: uid,
    reason: why,
    until,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.suspend",
    targetType: "user",
    targetId: uid,
    details: { reason: why, days, until: until.toISOString() },
  });
  await batch.commit();

  if (role === "farmer") await syncFarmerVisibility(uid, false);
  return until;
}

/** Shared by restoreUser and the automatic lifting of expired suspensions. */
async function restoreAccount(
  actorId: string,
  uid: string,
  role: string,
  claimsIn: Record<string, unknown> | undefined,
  reason?: string,
) {
  const auth = getAdminAuth();
  const claims = { ...claimsIn };
  delete claims.blocked;
  delete claims.suspendedUntil;
  await auth.setCustomUserClaims(uid, claims);
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
 * Security Rules via `users.restrictions`.
 */
export async function setRestrictions(
  actor: Actor,
  uid: string,
  restrictions: AccountRestriction[],
  reason: string,
) {
  assertCan(actor, "users.moderate");
  assertNotSelf(actor, uid);
  const list = [...new Set(restrictions)];
  if (
    !list.every((r) => (ACCOUNT_RESTRICTIONS as readonly string[]).includes(r))
  )
    throw new AdminOperationError("invalid_input");
  const why = cleanReason(reason);
  await loadTarget(uid);

  const batch = getAdminDb().batch();
  batch.update(col(COLLECTIONS.users).doc(uid), {
    restrictions: list.length ? list : FieldValue.delete(),
    updatedAt: serverNow(),
  });
  addModerationAction(batch, {
    actorId: actor.uid,
    action: "user.restrict",
    targetType: "user",
    targetId: uid,
    reason: why,
    restrictions: list,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "user.restrict",
    targetType: "user",
    targetId: uid,
    details: { restrictions: list, reason: why },
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

/** Moves a report through review. Closing (resolved/dismissed) needs an outcome note. */
export async function updateReport(
  actor: Actor,
  reportId: string,
  status: ReportStatus,
  resolution?: string,
) {
  assertCan(actor, "reports.manage");
  if (!(REPORT_STATUSES as readonly string[]).includes(status))
    throw new AdminOperationError("invalid_input");
  const closing = status === "resolved" || status === "dismissed";
  const note = closing
    ? cleanReason(resolution, 3, 2000)
    : resolution?.trim() || undefined;
  const ref = col(COLLECTIONS.reports).doc(reportId);
  const snap = await ref.get();
  if (!snap.exists) throw new AdminOperationError("not_found");
  if (snap.get("status") === status && !note)
    throw new AdminOperationError("invalid_state");

  const batch = getAdminDb().batch();
  batch.update(ref, {
    status,
    ...(note ? { resolution: note } : {}),
    handledBy: actor.uid,
    updatedAt: serverNow(),
  });
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
    details: { from: snap.get("status"), to: status },
  });
  await batch.commit();
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
  batch.set(col(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCS.moderation), {
    listingsRequireApproval: input.listingsRequireApproval,
    updatedAt: serverNow(),
    updatedBy: actor.uid,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "settings.update",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.moderation,
    details: { listingsRequireApproval: input.listingsRequireApproval },
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
