import { describe, expect, it } from "vitest";
import {
  ADMIN_PERMISSIONS,
  LEVEL_PERMISSIONS,
  adminCan,
  adminLevelOf,
} from "./admin";

describe("admin levels", () => {
  it("owners can do everything", () => {
    for (const p of ADMIN_PERMISSIONS) expect(adminCan("owner", p)).toBe(true);
  });

  it("moderators review and moderate but can't block, change roles, feature, or edit settings/reference data", () => {
    expect(LEVEL_PERMISSIONS.moderator).toEqual([
      "admin.view",
      "farmers.approve",
      "users.moderate",
      "products.moderate",
      "reports.manage",
    ]);
    for (const p of [
      "users.block",
      "users.role",
      "products.feature",
      "reference.manage",
      "settings.manage",
      "payments.verify",
      "logs.view",
    ] as const)
      expect(adminCan("moderator", p)).toBe(false);
  });

  it("missing or unknown levels get the least privilege; no level means no access", () => {
    expect(adminLevelOf(undefined)).toBe("moderator");
    expect(adminLevelOf("superuser")).toBe("moderator");
    expect(adminLevelOf("owner")).toBe("owner");
    expect(adminCan(undefined, "admin.view")).toBe(false);
  });
});
