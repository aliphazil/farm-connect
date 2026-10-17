/**
 * Administrator levels and what each may do.
 *
 * The level is the `adminLevel` custom claim, set only by
 * scripts/grant-admin.mts (Admin SDK credentials required). The web app has
 * no endpoint that grants or raises admin privileges, so an administrator
 * can't promote themselves from a browser request. Every privileged Server
 * Action checks a permission from this table against the verified session,
 * and the service it calls checks again.
 */
export const ADMIN_LEVELS = ["moderator", "owner"] as const;
export type AdminLevel = (typeof ADMIN_LEVELS)[number];

export const ADMIN_PERMISSIONS = [
  /** Dashboard, user/product/report lists and details. */
  "admin.view",
  /** Approve or reject farmer registrations. */
  "farmers.approve",
  /** Restrict features, suspend temporarily, lift suspensions. */
  "users.moderate",
  /** Block indefinitely and restore blocked accounts. */
  "users.block",
  /** Switch a member between consumer and farmer. */
  "users.role",
  /** Approve, reject, remove, restore and pause listings. */
  "products.moderate",
  /** Homepage featured products and farms. */
  "products.feature",
  /** Review and resolve reports. */
  "reports.manage",
  /** Categories, units and islands. */
  "reference.manage",
  /** Platform moderation settings (e.g. listing pre-approval). */
  "settings.manage",
  /** Mark recorded payments verified/rejected. */
  "payments.verify",
  /** Read the admin audit log. */
  "logs.view",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const MODERATOR: readonly AdminPermission[] = [
  "admin.view",
  "farmers.approve",
  "users.moderate",
  "products.moderate",
  "reports.manage",
];

export const LEVEL_PERMISSIONS: Record<AdminLevel, readonly AdminPermission[]> =
  {
    moderator: MODERATOR,
    owner: ADMIN_PERMISSIONS,
  };

/**
 * The level from a claim value. Anything missing or unknown is treated as the
 * least-privileged level.
 */
export function adminLevelOf(value: unknown): AdminLevel {
  return value === "owner" ? "owner" : "moderator";
}

export function adminCan(
  level: AdminLevel | undefined,
  permission: AdminPermission,
): boolean {
  return !!level && LEVEL_PERMISSIONS[level].includes(permission);
}

/**
 * Features an administrator can switch off for one account. Enforced by
 * Security Rules (firebase/firestore.rules → notRestricted()).
 */
export const ACCOUNT_RESTRICTIONS = [
  "enquiries",
  "listings",
  "reports",
] as const;
export type AccountRestriction = (typeof ACCOUNT_RESTRICTIONS)[number];

/** Suspension lengths offered in the admin UI, in days. */
export const SUSPENSION_DAYS = [1, 3, 7, 14, 30, 90] as const;

/** Actor id for automatic operations (e.g. lifting an expired suspension). */
export const SYSTEM_ACTOR = "system";
