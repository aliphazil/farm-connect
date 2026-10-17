"use server";

import { updateTag } from "next/cache";
import type {
  AccountRestriction,
  AdminPermission,
} from "@shared/constants/admin";
import type { SelfServiceRole } from "@shared/constants/roles";
import type {
  BrandingInput,
  FarmerApprovalStatus,
  IslandInput,
  PaymentVerification,
  ProductModeration,
  ReferenceLabelInput,
  ReportStatus,
} from "@shared/schemas";
import { AuthorizationError, assertAdminPermission } from "@/lib/auth/session";
import * as admin from "@/services/server/admin";

/**
 * Server Actions for the admin portal. Each one re-verifies the session and
 * the admin level's permission (shared/constants/admin.ts) before calling the
 * privileged service, which checks the permission again. None of them can
 * grant or raise admin privileges.
 *
 * Results are returned rather than thrown so the UI can show what happened.
 */

export type AdminActionResult =
  | { ok: true; id?: string; count?: number }
  | { ok: false; error: admin.AdminErrorCode | "unauthorized" | "failed" };

type Tag = "catalog" | "geography" | "reference";

async function run(
  permission: AdminPermission,
  work: (actor: admin.Actor) => Promise<unknown>,
  tags: Tag[] = [],
): Promise<AdminActionResult> {
  try {
    const user = await assertAdminPermission(permission);
    const value = await work({
      uid: user.uid,
      role: user.role,
      adminLevel: user.adminLevel,
    });
    for (const tag of tags) updateTag(tag);
    return {
      ok: true,
      ...(typeof value === "string" ? { id: value } : {}),
      ...(typeof value === "number" ? { count: value } : {}),
    };
  } catch (error) {
    if (error instanceof AuthorizationError)
      return { ok: false, error: "unauthorized" };
    if (error instanceof admin.AdminOperationError)
      return { ok: false, error: error.code };
    console.error("Admin action failed", error);
    return { ok: false, error: "failed" };
  }
}

// ---------- accounts ----------

export async function blockUserAction(uid: string, reason: string) {
  return run("users.block", (a) => admin.blockUser(a, uid, reason), [
    "catalog",
  ]);
}

export async function suspendUserAction(
  uid: string,
  days: number,
  reason: string,
) {
  return run("users.moderate", (a) => admin.suspendUser(a, uid, days, reason), [
    "catalog",
  ]);
}

export async function restoreUserAction(uid: string, reason?: string) {
  // The service decides which permission applies (suspended vs blocked).
  return run("users.moderate", (a) => admin.restoreUser(a, uid, reason), [
    "catalog",
  ]);
}

export async function setRestrictionsAction(
  uid: string,
  restrictions: AccountRestriction[],
  reason: string,
) {
  return run("users.moderate", (a) =>
    admin.setRestrictions(a, uid, restrictions, reason),
  );
}

export async function liftExpiredSuspensionsAction() {
  return run("users.moderate", (a) => admin.liftAllExpiredSuspensions(a), [
    "catalog",
  ]);
}

export async function setFarmerApprovalAction(
  uid: string,
  status: Exclude<FarmerApprovalStatus, "pending">,
  reason?: string,
) {
  return run(
    "farmers.approve",
    (a) => admin.setFarmerApproval(a, uid, status, reason),
    ["catalog"],
  );
}

export async function changeRoleAction(uid: string, role: SelfServiceRole) {
  return run("users.role", (a) => admin.changeRole(a, uid, role), ["catalog"]);
}

// ---------- listings ----------

export async function setProductModerationAction(
  productId: string,
  moderation: ProductModeration,
  reason: string,
  reportId?: string,
) {
  return run(
    "products.moderate",
    (a) =>
      admin.setProductModeration(a, productId, moderation, reason, reportId),
    ["catalog"],
  );
}

export async function deactivateProductAction(
  productId: string,
  reason: string,
) {
  return run(
    "products.moderate",
    (a) => admin.deactivateProduct(a, productId, reason),
    ["catalog"],
  );
}

export async function setFeaturedAction(
  targetType: "product" | "farmer",
  targetId: string,
  featured: boolean,
) {
  return run(
    "products.feature",
    (a) => admin.setFeatured(a, targetType, targetId, featured),
    ["catalog"],
  );
}

// ---------- reports ----------

export async function updateReportAction(
  reportId: string,
  status: ReportStatus,
  resolution?: string,
) {
  return run("reports.manage", (a) =>
    admin.updateReport(a, reportId, status, resolution),
  );
}

// ---------- payments, branding, settings ----------

export async function verifyPaymentAction(
  paymentId: string,
  status: Exclude<PaymentVerification, "unverified">,
) {
  return run("payments.verify", (a) =>
    admin.verifyPayment(a, paymentId, status),
  );
}

export async function publishBrandingAction(input: BrandingInput) {
  return run("settings.manage", (a) => admin.publishBranding(a, input));
}

export async function setModerationSettingsAction(
  listingsRequireApproval: boolean,
) {
  return run("settings.manage", (a) =>
    admin.setModerationSettings(a, { listingsRequireApproval }),
  );
}

// ---------- reference data ----------

export async function updateReferenceItemAction(
  kind: "category" | "unit",
  id: string,
  input: ReferenceLabelInput,
) {
  return run(
    "reference.manage",
    (a) => admin.updateReferenceItem(a, kind, id, input),
    ["reference"],
  );
}

export async function createIslandAction(input: IslandInput) {
  return run("reference.manage", (a) => admin.createIsland(a, input), [
    "geography",
    "catalog",
  ]);
}

export async function updateIslandAction(islandId: string, input: IslandInput) {
  return run(
    "reference.manage",
    (a) => admin.updateIsland(a, islandId, input),
    ["geography", "catalog"],
  );
}

export async function deleteIslandAction(islandId: string) {
  return run("reference.manage", (a) => admin.deleteIsland(a, islandId), [
    "geography",
    "catalog",
  ]);
}
