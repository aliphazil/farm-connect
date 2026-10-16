/**
 * Roles are stored as Firebase Auth custom claims (`role`), which only trusted
 * server code (Admin SDK) can set. Firestore/Storage rules and server code read
 * the claim; the client never decides its own role.
 */
export const ROLES = ["buyer", "farmer", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ["active", "blocked"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

/** Shape of the custom claims we set on a Firebase Auth user. */
export type AuthClaims = {
  role?: Role;
  blocked?: boolean;
};

/** Home path of each role's portal (without the locale prefix). */
export const ROLE_HOME: Record<Role, string> = {
  buyer: "/buyer",
  farmer: "/farmer",
  admin: "/admin",
};
