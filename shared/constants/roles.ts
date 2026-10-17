/**
 * Roles are stored as Firebase Auth custom claims (`role`), which only trusted
 * server code (Admin SDK) can set. Security Rules and server code read the
 * claim; the client never decides its own role. `users/{uid}.role` mirrors the
 * claim for display and queries but is never trusted for authorization.
 */
export const ROLES = ["consumer", "farmer", "admin"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Roles anyone may pick at registration. `admin` is deliberately absent: it is
 * granted only by the bootstrap script (scripts/grant-admin.mts).
 */
export const SELF_SERVICE_ROLES = ["consumer", "farmer"] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

/**
 * active: normal. suspended: temporarily locked until `users.suspendedUntil`
 * (lifted automatically at the next sign-in after that time, or by an
 * admin). blocked: locked indefinitely until an owner restores it.
 */
export const ACCOUNT_STATUSES = ["active", "suspended", "blocked"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Shape of the custom claims we set on a Firebase Auth user. */
export type AuthClaims = {
  role?: Role;
  blocked?: boolean;
  /** Admins only: "owner" or "moderator" (shared/constants/admin.ts). */
  adminLevel?: string;
  /** Epoch ms; set while an account is suspended. */
  suspendedUntil?: number;
};

/** Home path of each role's portal (without the locale prefix). */
export const ROLE_HOME: Record<Role, string> = {
  consumer: "/account",
  farmer: "/farmer",
  admin: "/admin",
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}
