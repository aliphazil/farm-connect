import "server-only";

import type { Role } from "@shared/constants/roles";
import { requireRole } from "./session";

/**
 * Who may open each portal. Every page under app/[locale]/{farmer,buyer,admin}
 * must call its portal's guard itself (enforced by portal-access.test.ts).
 *
 * Why in the page and not only the layout: with Cache Components / partial
 * prerendering, a page passed as `children` through a layout is prerendered
 * independently, so a layout-level check does not stop the page's output
 * from reaching the browser. A check inside the page makes the page itself
 * request-time, so nothing renders until access is confirmed.
 */
export const PORTAL_ROLES = {
  farmer: ["farmer"],
  buyer: ["buyer", "farmer"],
  admin: ["admin"],
} as const satisfies Record<string, readonly Role[]>;

export const requireFarmerPortal = () => requireRole(PORTAL_ROLES.farmer);
export const requireBuyerPortal = () => requireRole(PORTAL_ROLES.buyer);
export const requireAdminPortal = () => requireRole(PORTAL_ROLES.admin);
