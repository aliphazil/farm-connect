import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  completeRegistration,
  RegistrationError,
} from "@/services/server/registration";
import {
  AdminOperationError,
  blockUser,
  changeRole,
  publishBranding,
  setFarmerApproval,
  setProductModeration,
  unblockUser,
  verifyPayment,
} from "@/services/server/admin";
import { LOCATION_AA, PRODUCT_INPUT } from "../support/fixtures";

/**
 * Server services against the Auth + Firestore emulators (Admin SDK).
 * Each test uses fresh users, so tests don't depend on each other.
 */

const admin = {
  uid: "admin-actor",
  role: "admin",
  adminLevel: "owner" as const,
};
const notAdmin = { uid: "someone", role: "farmer" };

const farmerInput = {
  role: "farmer",
  displayName: "Aisha",
  preferredLocale: "en",
  acceptTerms: true,
  phone: "777 1234",
  farmName: { en: "Thoddoo Fields" },
  location: LOCATION_AA,
};
const consumerInput = {
  role: "consumer",
  displayName: "Hassan",
  preferredLocale: "dv",
  acceptTerms: true,
};

async function newAuthUser() {
  const email = `${randomUUID()}@example.test`;
  const user = await getAdminAuth().createUser({
    email,
    password: "correct-horse-battery",
  });
  return { uid: user.uid, email };
}

async function registeredFarmer() {
  const { uid, email } = await newAuthUser();
  await completeRegistration(uid, email, farmerInput);
  return uid;
}

const users = () => getAdminDb().collection(COLLECTIONS.users);

beforeAll(() => {
  if (
    !process.env.FIREBASE_AUTH_EMULATOR_HOST ||
    !process.env.FIRESTORE_EMULATOR_HOST
  ) {
    throw new Error("Run through `npm run test:emulator`");
  }
});

describe("completeRegistration", () => {
  it("creates a farmer account, pending farm profile and role claim", async () => {
    const { uid, email } = await newAuthUser();
    await expect(completeRegistration(uid, email, farmerInput)).resolves.toBe(
      "farmer",
    );

    const user = (await users().doc(uid).get()).data()!;
    expect(user).toMatchObject({
      role: "farmer",
      status: "active",
      email,
      phone: "+9607771234",
    });
    const farm = (
      await getAdminDb().collection(COLLECTIONS.farmerProfiles).doc(uid).get()
    ).data()!;
    expect(farm).toMatchObject({
      approvalStatus: "pending",
      verified: false,
      visible: true,
    });
    expect((await getAdminAuth().getUser(uid)).customClaims).toEqual({
      role: "farmer",
    });
  });

  it("creates a consumer account and consumer profile", async () => {
    const { uid, email } = await newAuthUser();
    await expect(completeRegistration(uid, email, consumerInput)).resolves.toBe(
      "consumer",
    );
    expect(
      (
        await getAdminDb()
          .collection(COLLECTIONS.consumerProfiles)
          .doc(uid)
          .get()
      ).exists,
    ).toBe(true);
  });

  it("never lets a user register as admin", async () => {
    const { uid, email } = await newAuthUser();
    await expect(
      completeRegistration(uid, email, { ...consumerInput, role: "admin" }),
    ).rejects.toMatchObject({
      code: "invalid_input",
    });
    expect((await getAdminAuth().getUser(uid)).customClaims ?? {}).toEqual({});
    expect((await users().doc(uid).get()).exists).toBe(false);
  });

  it("rejects incomplete farmer details and unaccepted terms", async () => {
    const { uid, email } = await newAuthUser();
    const noFarm = { ...farmerInput, farmName: undefined };
    await expect(
      completeRegistration(uid, email, noFarm),
    ).rejects.toBeInstanceOf(RegistrationError);
    await expect(
      completeRegistration(uid, email, {
        ...consumerInput,
        acceptTerms: false,
      }),
    ).rejects.toBeInstanceOf(RegistrationError);
  });

  it("refuses to register twice or to change an existing role", async () => {
    const { uid, email } = await newAuthUser();
    await completeRegistration(uid, email, consumerInput);
    await expect(
      completeRegistration(uid, email, farmerInput),
    ).rejects.toMatchObject({ code: "already_registered" });
    expect((await getAdminAuth().getUser(uid)).customClaims).toEqual({
      role: "consumer",
    });
  });

  it("repairs a missing claim from a server-written profile, but never restores admin", async () => {
    const { uid, email } = await newAuthUser();
    await users().doc(uid).set({ role: "consumer", status: "active" });
    await expect(completeRegistration(uid, email, consumerInput)).resolves.toBe(
      "consumer",
    );
    expect((await getAdminAuth().getUser(uid)).customClaims).toEqual({
      role: "consumer",
    });

    const other = await newAuthUser();
    await users().doc(other.uid).set({ role: "admin", status: "active" });
    await expect(
      completeRegistration(other.uid, other.email, consumerInput),
    ).rejects.toMatchObject({
      code: "already_registered",
    });
    expect(
      (await getAdminAuth().getUser(other.uid)).customClaims ?? {},
    ).toEqual({});
  });

  it("refuses disabled accounts", async () => {
    const { uid, email } = await newAuthUser();
    await getAdminAuth().updateUser(uid, { disabled: true });
    await expect(
      completeRegistration(uid, email, consumerInput),
    ).rejects.toMatchObject({ code: "account_blocked" });
  });
});

describe("admin operations", () => {
  it("reject non-admin actors", async () => {
    const uid = await registeredFarmer();
    await expect(blockUser(notAdmin, uid, "spam")).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      setFarmerApproval(notAdmin, uid, "approved"),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(changeRole(notAdmin, uid, "consumer")).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      verifyPayment(notAdmin, "x", "verified"),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      publishBranding({ uid: "x", role: null }, {} as never),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("approve a farm and publish its products; block and unblock hide and restore them", async () => {
    const uid = await registeredFarmer();
    const db = getAdminDb();
    const productRef = db.collection(COLLECTIONS.products).doc();
    await productRef.set({
      ...PRODUCT_INPUT,
      farmerId: uid,
      location: LOCATION_AA,
      moderation: "ok",
      farmerVisible: false,
    });

    await setFarmerApproval(admin, uid, "approved");
    expect((await productRef.get()).get("farmerVisible")).toBe(true);

    await blockUser(admin, uid, "Fraud reports confirmed");
    const authUser = await getAdminAuth().getUser(uid);
    // Firebase sign-in stays possible (for the appeal page); the claim,
    // revoked tokens, users.status and rules stop everything else.
    expect(authUser.disabled).toBe(false);
    expect(authUser.customClaims).toMatchObject({
      role: "farmer",
      blocked: true,
    });
    expect((await users().doc(uid).get()).get("status")).toBe("blocked");
    expect(
      (await db.collection(COLLECTIONS.farmerProfiles).doc(uid).get()).get(
        "visible",
      ),
    ).toBe(false);
    expect((await productRef.get()).get("farmerVisible")).toBe(false);

    await unblockUser(admin, uid);
    const restored = await getAdminAuth().getUser(uid);
    expect(restored.disabled).toBe(false);
    expect(restored.customClaims).toEqual({ role: "farmer" });
    const user = (await users().doc(uid).get()).data()!;
    expect(user.status).toBe("active");
    expect(user.blockedReason).toBeUndefined();
    expect((await productRef.get()).get("farmerVisible")).toBe(true);

    const logs = await db
      .collection(COLLECTIONS.adminLogs)
      .where("targetId", "==", uid)
      .get();
    expect(logs.docs.map((d) => d.get("action")).sort()).toEqual([
      "farmer.approval",
      "user.block",
      "user.restore",
    ]);
    const actions = await db
      .collection(COLLECTIONS.moderationActions)
      .where("targetId", "==", uid)
      .get();
    expect(actions.size).toBe(3);
  });

  it("can't block or re-role administrators, or the acting admin", async () => {
    const { uid, email } = await newAuthUser();
    await completeRegistration(uid, email, consumerInput);
    await getAdminAuth().setCustomUserClaims(uid, { role: "admin" });
    await expect(blockUser(admin, uid, "test")).rejects.toMatchObject({
      code: "cannot_target_admin",
    });
    await expect(changeRole(admin, uid, "farmer")).rejects.toMatchObject({
      code: "cannot_target_admin",
    });
    await expect(blockUser(admin, admin.uid, "self")).rejects.toMatchObject({
      code: "cannot_target_self",
    });
  });

  it("change a consumer to a farmer but never to admin", async () => {
    const { uid, email } = await newAuthUser();
    await completeRegistration(uid, email, {
      ...consumerInput,
      phone: "7771234",
      location: LOCATION_AA,
    });
    await expect(
      changeRole(admin, uid, "admin" as never),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await changeRole(admin, uid, "farmer");
    expect((await getAdminAuth().getUser(uid)).customClaims).toEqual({
      role: "farmer",
    });
    const farm = (
      await getAdminDb().collection(COLLECTIONS.farmerProfiles).doc(uid).get()
    ).data()!;
    expect(farm.approvalStatus).toBe("pending");
  });

  it("moderate products, verify payments and validate branding", async () => {
    const db = getAdminDb();
    const productRef = db.collection(COLLECTIONS.products).doc();
    await productRef.set({ farmerId: "f", moderation: "ok" });
    await setProductModeration(
      admin,
      productRef.id,
      "removed",
      "Prohibited item",
    );
    expect((await productRef.get()).get("moderation")).toBe("removed");

    const paymentRef = db.collection(COLLECTIONS.payments).doc();
    await paymentRef.set({ farmerId: "f", verificationStatus: "unverified" });
    await verifyPayment(admin, paymentRef.id, "verified");
    expect((await paymentRef.get()).data()).toMatchObject({
      verificationStatus: "verified",
      verifiedBy: admin.uid,
    });
    await expect(
      verifyPayment(admin, "missing", "verified"),
    ).rejects.toBeInstanceOf(AdminOperationError);

    await expect(
      publishBranding(admin, {
        siteName: { en: "X" },
        primaryColor: "green",
        accentColor: "#000000",
      } as never),
    ).rejects.toMatchObject({ code: "invalid_input" });
    await publishBranding(admin, {
      siteName: { en: "FarmConnect" },
      primaryColor: "#15803d",
      accentColor: "#0e7490",
    });
    const branding = (
      await db.collection(COLLECTIONS.siteSettings).doc("branding").get()
    ).data()!;
    expect(branding).toMatchObject({
      primaryColor: "#15803d",
      updatedBy: admin.uid,
    });
  });
});
