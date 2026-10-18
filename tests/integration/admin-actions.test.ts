import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getClientAuth } from "@/lib/firebase/client";
import { completeRegistration } from "@/services/server/registration";
import {
  blockUserAction,
  changeRoleAction,
  setModerationSettingsAction,
  setRestrictionsAction,
  suspendUserAction,
  restoreUserAction,
} from "@/features/admin/actions";
import { setTestCookie } from "../support/next-headers-stub";

/**
 * The Server Actions themselves (not just the services): each verifies the
 * session cookie and the admin level's permission before doing anything.
 */

const PASSWORD = "correct-horse-battery";

async function account(claims: Record<string, unknown> | null) {
  const email = `actions-${randomUUID()}@example.test`;
  const { uid } = await getAdminAuth().createUser({
    email,
    password: PASSWORD,
  });
  if (claims?.role === "admin") {
    await getAdminDb().collection(COLLECTIONS.users).doc(uid).set({
      role: "admin",
      status: "active",
      displayName: "Admin",
      preferredLocale: "en",
    });
    await getAdminAuth().setCustomUserClaims(uid, claims);
  } else {
    await completeRegistration(uid, email, {
      role: "consumer",
      displayName: "Buyer",
      preferredLocale: "en",
      acceptTerms: true,
    });
  }
  return { uid, email };
}

/** Signs in for real and installs that user's session cookie for the next calls. */
async function actAs(email: string | null) {
  if (!email) return setTestCookie("__session", null);
  await signOut(getClientAuth()).catch(() => undefined);
  const { user } = await signInWithEmailAndPassword(
    getClientAuth(),
    email,
    PASSWORD,
  );
  const idToken = await user.getIdToken(true);
  const cookie = await getAdminAuth().createSessionCookie(idToken, {
    expiresIn: 60 * 60 * 1000,
  });
  setTestCookie("__session", cookie);
}

let owner: { uid: string; email: string };
let moderator: { uid: string; email: string };
let target: { uid: string; email: string };

beforeAll(async () => {
  owner = await account({ role: "admin", adminLevel: "owner" });
  moderator = await account({ role: "admin", adminLevel: "moderator" });
  target = await account(null);
});

afterAll(async () => {
  setTestCookie("__session", null);
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("admin Server Actions", () => {
  it("refuse guests and non-admins", async () => {
    await actAs(null);
    expect(await suspendUserAction(target.uid, 7, "x x x")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    await actAs(target.email); // a signed-in buyer
    expect(await setRestrictionsAction(target.uid, [], "x x x")).toEqual({
      ok: false,
      error: "unauthorized",
    });
  });

  it("let a moderator moderate but not block, change roles or settings", async () => {
    await actAs(moderator.email);
    expect(await blockUserAction(target.uid, "Fraud")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(await changeRoleAction(target.uid, "farmer")).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(await setModerationSettingsAction(true)).toEqual({
      ok: false,
      error: "unauthorized",
    });
    expect(await suspendUserAction(target.uid, 3, "Cooling off")).toEqual({
      ok: true,
    });
    expect(await restoreUserAction(target.uid)).toEqual({ ok: true });
    // Moderators can't act on themselves either.
    expect(
      await setRestrictionsAction(moderator.uid, ["reports"], "self test"),
    ).toEqual({
      ok: false,
      error: "cannot_target_self",
    });
  });

  it("let an owner block and restore, and report invalid input clearly", async () => {
    await actAs(owner.email);
    expect(await blockUserAction(target.uid, "")).toEqual({
      ok: false,
      error: "invalid_input",
    });
    expect(await blockUserAction(target.uid, "Confirmed fraud")).toMatchObject({
      ok: true,
    });
    expect(await restoreUserAction(target.uid, "Appeal")).toEqual({ ok: true });
    // An owner can't use the app to target another administrator.
    expect(await blockUserAction(moderator.uid, "nope")).toEqual({
      ok: false,
      error: "cannot_target_admin",
    });
  });
});
