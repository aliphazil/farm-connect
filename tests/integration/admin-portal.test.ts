import { randomInt, randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dictionaries } from "@shared/i18n";
import { COLLECTIONS } from "@shared/firestore-paths";
import { buildFavourite } from "@shared/payloads";
import type { ProductInput } from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import {
  AdminOperationError,
  blockUser,
  changeRole,
  createIsland,
  deactivateProduct,
  deleteIsland,
  liftExpiredSuspension,
  restoreUser,
  setFarmerApproval,
  setFeatured,
  setModerationSettings,
  setProductModeration,
  setRestrictions,
  suspendUser,
  updateIsland,
  updateReferenceItem,
  updateReport,
  verifyPayment,
  type Actor,
} from "@/services/server/admin";
import {
  getAdminStats,
  getProductDetail,
  getUserDetail,
  listProductsAdmin,
  listReports,
  listUsers,
} from "@/services/server/admin-queries";
import {
  getReferenceSettings,
  withReferenceLabels,
} from "@/services/server/reference";
import { completeRegistration } from "@/services/server/registration";
import { sendEnquiry, submitReport } from "@/services/client/interactions";
import {
  createProduct,
  newProductId,
  updateProduct,
} from "@/services/client/products";

/**
 * Admin portal back end against the emulators: the permission model, account
 * status changes, restrictions (enforced by Security Rules for real client
 * writes), listing review, reports, reference data and statistics.
 */

const PASSWORD = "correct-horse-battery";
const RUN = randomUUID().slice(0, 8);
const ISLAND = `aa-admin-${RUN}`;
const LOCATION = { atollCode: "AA", islandId: ISLAND } as const;

const owner: Actor = { uid: "owner-actor", role: "admin", adminLevel: "owner" };
const moderator: Actor = {
  uid: "moderator-actor",
  role: "admin",
  adminLevel: "moderator",
};
const levelless: Actor = { uid: "old-admin", role: "admin" };
const farmerActor: Actor = { uid: "x", role: "farmer" };

const input: ProductInput = {
  title: { en: `Pumpkin ${RUN}` },
  category: "vegetables",
  unit: "kg",
  priceLaari: 1800,
  quantityAvailable: 20,
  imagePaths: [],
  deliveryDestinations: [{ atollCode: "AA" }],
  status: "active",
};

const phone = () => `7${String(randomInt(0, 999999)).padStart(6, "0")}`;

async function register(role: "farmer" | "consumer", name: string) {
  const email = `${role}-${randomUUID()}@example.test`;
  const ph = phone();
  const { uid } = await getAdminAuth().createUser({
    email,
    password: PASSWORD,
  });
  await completeRegistration(
    uid,
    email,
    role === "farmer"
      ? {
          role,
          displayName: name,
          preferredLocale: "en",
          acceptTerms: true,
          phone: ph,
          farmName: { en: `${name} Farm ${RUN}` },
          location: LOCATION,
        }
      : {
          role,
          displayName: name,
          preferredLocale: "en",
          acceptTerms: true,
          phone: ph,
        },
  );
  return { uid, email, phone: `+960${ph}` };
}

async function signInAs(email: string) {
  await signOut(getClientAuth()).catch(() => undefined);
  await signInWithEmailAndPassword(getClientAuth(), email, PASSWORD);
  await getClientAuth().currentUser!.getIdToken(true);
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof AdminOperationError ? e.code : `other:${String(e)}`;
  }
};
const db = () => getAdminDb();
const userDoc = async (uid: string) =>
  (await db().collection(COLLECTIONS.users).doc(uid).get()).data()!;
const productDoc = async (id: string) =>
  (await db().collection(COLLECTIONS.products).doc(id).get()).data()!;

let farmer: Awaited<ReturnType<typeof register>>;
let buyer: Awaited<ReturnType<typeof register>>;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  await db()
    .collection(COLLECTIONS.islands)
    .doc(ISLAND)
    .set({ atollCode: "AA", nameEn: `Admin Island ${RUN}`, active: true });
  farmer = await register("farmer", "Aminath");
  buyer = await register("consumer", "Ahmed");
  // Real admin accounts exist so "can't target an admin" can be tested.
  await db().collection(COLLECTIONS.users).doc(owner.uid).set({
    role: "admin",
    status: "active",
    displayName: "Owner",
    preferredLocale: "en",
  });
});

afterAll(async () => {
  await signOut(getClientAuth()).catch(() => undefined);
  await setModerationSettings(owner, { listingsRequireApproval: false });
});

describe("admin permission model", () => {
  it("moderators can't use owner-only operations; non-admins can't use any", async () => {
    expect(await code(blockUser(moderator, buyer.uid, "spam"))).toBe(
      "forbidden",
    );
    expect(await code(changeRole(moderator, buyer.uid, "farmer"))).toBe(
      "forbidden",
    );
    expect(await code(setFeatured(moderator, "product", "x", true))).toBe(
      "forbidden",
    );
    expect(
      await code(
        setModerationSettings(moderator, { listingsRequireApproval: true }),
      ),
    ).toBe("forbidden");
    expect(
      await code(
        updateReferenceItem(moderator, "unit", "kg", {
          labelEn: "",
          labelDv: "",
          active: true,
        }),
      ),
    ).toBe("forbidden");
    expect(
      await code(
        createIsland(moderator, {
          atollCode: "AA",
          nameEn: "X",
          nameDv: "",
          active: true,
        }),
      ),
    ).toBe("forbidden");
    expect(await code(verifyPayment(moderator, "p", "verified"))).toBe(
      "forbidden",
    );
    // Admins without a level claim get the least privilege.
    expect(await code(blockUser(levelless, buyer.uid, "spam"))).toBe(
      "forbidden",
    );
    // Non-admins can't do anything.
    expect(await code(suspendUser(farmerActor, buyer.uid, 7, "spam"))).toBe(
      "forbidden",
    );
    expect(
      await code(setFarmerApproval(farmerActor, farmer.uid, "approved")),
    ).toBe("forbidden");
  });

  it("no one can act on their own account or on administrators", async () => {
    expect(
      await code(
        suspendUser({ ...moderator, uid: buyer.uid }, buyer.uid, 7, "self"),
      ),
    ).toBe("cannot_target_self");
    expect(await code(suspendUser(moderator, owner.uid, 7, "nope"))).toBe(
      "not_found",
    );
    await getAdminAuth()
      .createUser({
        uid: owner.uid,
        email: `owner-${RUN}@example.test`,
        password: PASSWORD,
      })
      .catch(() => undefined);
    await getAdminAuth().setCustomUserClaims(owner.uid, {
      role: "admin",
      adminLevel: "owner",
    });
    expect(await code(suspendUser(moderator, owner.uid, 7, "nope"))).toBe(
      "cannot_target_admin",
    );
    expect(
      await code(
        blockUser({ ...owner, uid: "other-owner" }, owner.uid, "nope"),
      ),
    ).toBe("cannot_target_admin");
  });

  it("moderators approve farms; rejection needs a reason", async () => {
    expect(
      await code(setFarmerApproval(moderator, farmer.uid, "rejected")),
    ).toBe("invalid_input");
    await setFarmerApproval(moderator, farmer.uid, "approved");
    expect(
      (
        await db().collection(COLLECTIONS.farmerProfiles).doc(farmer.uid).get()
      ).get("approvalStatus"),
    ).toBe("approved");
  });
});

describe("restrictions (enforced by Security Rules)", () => {
  it("switch off enquiries and reports for one account, then back on", async () => {
    await signInAs(farmer.email);
    const productId = await createProduct(newProductId(), input);

    await setRestrictions(
      moderator,
      buyer.uid,
      ["enquiries", "reports"],
      "Repeated spam enquiries",
    );
    expect((await userDoc(buyer.uid)).restrictions).toEqual([
      "enquiries",
      "reports",
    ]);

    await signInAs(buyer.email);
    const enquiry = { productId, quantity: 1, deliverTo: LOCATION };
    await expect(sendEnquiry(enquiry)).rejects.toThrow();
    await expect(
      submitReport({
        targetType: "product",
        targetId: productId,
        reason: "other",
        details: "Testing reports.",
      }),
    ).rejects.toThrow();
    // Saving favourites isn't restricted.
    const fav = buildFavourite(
      buyer.uid,
      "product",
      productId,
      serverTimestamp(),
    );
    await setDoc(doc(getClientDb(), COLLECTIONS.favourites, fav.id), fav.data);

    await setRestrictions(moderator, buyer.uid, [], "Appeal accepted");
    expect((await userDoc(buyer.uid)).restrictions).toBeUndefined();
    await expect(sendEnquiry(enquiry)).resolves.toBeTruthy();

    const detail = await getUserDetail(buyer.uid);
    expect(
      detail?.history.filter((h) => h.action === "user.restrict"),
    ).toHaveLength(2);
  });

  it("stop a farmer publishing", async () => {
    await setRestrictions(
      moderator,
      farmer.uid,
      ["listings"],
      "Misleading prices",
    );
    await signInAs(farmer.email);
    await expect(createProduct(newProductId(), input)).rejects.toThrow();
    await expect(
      createProduct(newProductId(), { ...input, status: "draft" }),
    ).resolves.toBeTruthy();
    await setRestrictions(moderator, farmer.uid, [], "Fixed");
  });

  it("reject unknown features", async () => {
    expect(
      await code(
        setRestrictions(moderator, buyer.uid, ["everything" as never], "x x x"),
      ),
    ).toBe("invalid_input");
  });
});

describe("suspension", () => {
  it("hides a farmer's listings, blocks writes, and lifts itself once it ends", async () => {
    await signInAs(farmer.email);
    const productId = await createProduct(newProductId(), input);
    expect((await productDoc(productId)).isPublic).toBe(true);

    expect(
      await code(suspendUser(moderator, farmer.uid, 5, "Under investigation")),
    ).toBe("invalid_input");
    const until = await suspendUser(
      moderator,
      farmer.uid,
      7,
      "Under investigation",
    );
    expect(until.getTime()).toBeGreaterThan(Date.now() + 6 * 86400e3);
    expect(await userDoc(farmer.uid)).toMatchObject({
      status: "suspended",
      blockedReason: "Under investigation",
    });
    expect((await productDoc(productId)).isPublic).toBe(false);
    const claims = (await getAdminAuth().getUser(farmer.uid)).customClaims;
    expect(claims?.suspendedUntil).toBe(until.getTime());
    // Sign-in still works (so the suspension can lift itself later), but writes don't.
    expect((await getAdminAuth().getUser(farmer.uid)).disabled).toBe(false);
    await signInAs(farmer.email);
    await expect(
      updateProduct(productId, { priceLaari: 1000 }),
    ).rejects.toThrow();

    // Not over yet: stays suspended.
    expect(await liftExpiredSuspension(farmer.uid)).toBe(false);

    // Pretend it ended yesterday.
    await db()
      .collection(COLLECTIONS.users)
      .doc(farmer.uid)
      .update({ suspendedUntil: new Date(Date.now() - 86400e3) });
    expect(await liftExpiredSuspension(farmer.uid)).toBe(true);
    expect((await userDoc(farmer.uid)).status).toBe("active");
    expect(
      (await getAdminAuth().getUser(farmer.uid)).customClaims?.suspendedUntil,
    ).toBeUndefined();
    expect((await productDoc(productId)).isPublic).toBe(true);

    const history = (await getUserDetail(farmer.uid))!.history.map(
      (h) => h.action,
    );
    expect(history).toEqual(
      expect.arrayContaining(["user.suspend", "user.restore"]),
    );
    expect(
      (await getUserDetail(farmer.uid))!.history.find(
        (h) => h.action === "user.restore",
      )?.actorName,
    ).toBe("System");
  });

  it("can't suspend a blocked account; restoring a block needs an owner", async () => {
    const target = await register("consumer", "Ali");
    await blockUser(owner, target.uid, "Fraud confirmed");
    expect(await code(suspendUser(moderator, target.uid, 7, "x x x"))).toBe(
      "invalid_state",
    );
    expect(await code(restoreUser(moderator, target.uid))).toBe("forbidden");
    await restoreUser(owner, target.uid, "Appeal accepted");
    expect((await userDoc(target.uid)).status).toBe("active");
    expect(await code(restoreUser(owner, target.uid))).toBe("invalid_state");

    // A moderator can lift a suspension early.
    await suspendUser(moderator, target.uid, 1, "Cooling off");
    await restoreUser(moderator, target.uid);
    expect((await userDoc(target.uid)).status).toBe("active");
  });
});

describe("listing review", () => {
  it("pre-approval: pending → rejected (with note) → resubmitted → approved → removed → restored", async () => {
    await setModerationSettings(owner, { listingsRequireApproval: true });
    await signInAs(farmer.email);
    const id = await createProduct(newProductId(), {
      ...input,
      title: { en: `Review me ${RUN}` },
    });
    expect(await productDoc(id)).toMatchObject({
      moderation: "pending",
      isPublic: false,
    });

    const pending = await listProductsAdmin({ moderation: "pending" });
    expect(pending.items.map((p) => p.id)).toContain(id);

    expect(
      await code(setProductModeration(moderator, id, "rejected", "")),
    ).toBe("invalid_input");
    await setProductModeration(
      moderator,
      id,
      "rejected",
      "Photo doesn't match the product",
    );
    expect(await productDoc(id)).toMatchObject({
      moderation: "rejected",
      moderationNote: "Photo doesn't match the product",
    });

    // Farmer edits → resubmitted for review.
    await updateProduct(id, { priceLaari: 1700 });
    expect((await productDoc(id)).moderation).toBe("pending");

    await setProductModeration(moderator, id, "ok", "");
    expect(await productDoc(id)).toMatchObject({
      moderation: "ok",
      isPublic: true,
    });
    expect((await productDoc(id)).moderationNote).toBeUndefined();

    expect(
      await code(setProductModeration(moderator, id, "rejected", "late")),
    ).toBe("invalid_state");
    await setProductModeration(moderator, id, "removed", "Prohibited item");
    expect((await productDoc(id)).isPublic).toBe(false);
    await expect(updateProduct(id, { priceLaari: 1600 })).rejects.toThrow();
    await setProductModeration(moderator, id, "ok", "Reviewed again");
    expect((await productDoc(id)).isPublic).toBe(true);

    const history = (await getProductDetail(id))!.history.map(
      (h) => h.details?.to,
    );
    expect(history).toEqual(["ok", "removed", "ok", "rejected"]);
    await setModerationSettings(owner, { listingsRequireApproval: false });
  });

  it("marks listings inactive and features only live listings", async () => {
    await signInAs(farmer.email);
    const live = await createProduct(newProductId(), input);
    const draft = await createProduct(newProductId(), {
      ...input,
      status: "draft",
    });

    expect(await code(setFeatured(owner, "product", draft, true))).toBe(
      "invalid_state",
    );
    await setFeatured(owner, "product", live, true);
    const featured = await db()
      .collection(COLLECTIONS.siteSettings)
      .doc("featured")
      .get();
    expect(featured.get("productIds")).toContain(live);
    expect((await getProductDetail(live))!.product.featured).toBe(true);
    await setFeatured(owner, "product", live, false);

    await deactivateProduct(moderator, live, "Out of season");
    expect(await productDoc(live)).toMatchObject({
      status: "paused",
      isPublic: false,
    });
    expect(await code(deactivateProduct(moderator, live, "again"))).toBe(
      "invalid_state",
    );
  });
});

describe("reports", () => {
  it("move through review; closing needs an outcome the reporter can read", async () => {
    await signInAs(buyer.email);
    await submitReport({
      targetType: "farmer",
      targetId: farmer.uid,
      reason: "non_delivery",
      details: "Paid but nothing arrived.",
    });
    const awaiting = await listReports({
      status: "awaiting",
      targetType: "farmer",
    });
    const report = awaiting.items.find(
      (r) => r.reporterId === buyer.uid && r.targetId === farmer.uid,
    )!;
    expect(report.targetLabel).toEqual({ en: `Aminath Farm ${RUN}` });
    expect(report.reporterName).toBe("Ahmed");

    await updateReport(moderator, report.id, "reviewing");
    expect(await code(updateReport(moderator, report.id, "resolved", ""))).toBe(
      "invalid_input",
    );
    await updateReport(
      moderator,
      report.id,
      "resolved",
      "Farmer refunded the buyer.",
    );
    const saved = (
      await db().collection(COLLECTIONS.reports).doc(report.id).get()
    ).data()!;
    expect(saved).toMatchObject({
      status: "resolved",
      resolution: "Farmer refunded the buyer.",
      handledBy: moderator.uid,
    });
    expect(
      (await getUserDetail(farmer.uid))!.reportsAbout.map((r) => r.id),
    ).toContain(report.id);
  });
});

describe("reference data", () => {
  it("edits category/unit labels and availability, used by the dictionary", async () => {
    await updateReferenceItem(owner, "unit", "bundle", {
      labelEn: "Bunch (big)",
      labelDv: "",
      active: false,
    });
    const ref = await getReferenceSettings();
    expect(ref.units.bundle).toMatchObject({
      active: false,
      label: { en: "Bunch (big)" },
    });
    const dict = withReferenceLabels(dictionaries.en, "en", ref);
    expect(dict.units.bundle).toBe("Bunch (big)");
    // Blank Dhivehi falls back to the built-in translation.
    expect(withReferenceLabels(dictionaries.dv, "dv", ref).units.bundle).toBe(
      dictionaries.dv.units.bundle,
    );
    expect(
      await code(
        updateReferenceItem(owner, "unit", "furlong", {
          labelEn: "",
          labelDv: "",
          active: true,
        }),
      ),
    ).toBe("not_found");
    await updateReferenceItem(owner, "unit", "bundle", {
      labelEn: "",
      labelDv: "",
      active: true,
    });
  });

  it("keeps island ids stable and refuses to break references", async () => {
    const id = await createIsland(owner, {
      atollCode: "K",
      nameEn: `Test Isle ${RUN}`,
      nameDv: "",
      active: true,
    });
    expect(id).toBe(`k-test-isle-${RUN.toLowerCase()}`);
    expect(
      await code(
        createIsland(owner, {
          atollCode: "K",
          nameEn: `Test Isle ${RUN}`,
          nameDv: "",
          active: true,
        }),
      ),
    ).toBe("already_exists");
    // Unused: can move atoll and be deleted.
    await updateIsland(owner, id, {
      atollCode: "AA",
      nameEn: "Renamed",
      nameDv: "",
      active: false,
    });
    expect(
      (await db().collection(COLLECTIONS.islands).doc(id).get()).data(),
    ).toMatchObject({
      atollCode: "AA",
      nameEn: "Renamed",
      active: false,
    });
    await deleteIsland(owner, id);

    // In use (the farm is on ISLAND): renaming is fine, moving or deleting isn't.
    await updateIsland(owner, ISLAND, {
      atollCode: "AA",
      nameEn: `Admin Island ${RUN}`,
      nameDv: "",
      active: true,
    });
    expect(
      await code(
        updateIsland(owner, ISLAND, {
          atollCode: "K",
          nameEn: "x x",
          nameDv: "",
          active: true,
        }),
      ),
    ).toBe("in_use");
    expect(await code(deleteIsland(owner, ISLAND))).toBe("in_use");
  });
});

describe("dashboard and lists", () => {
  it("statistics come from real records and respect the date range", async () => {
    const now = new Date();
    await db()
      .collection(COLLECTIONS.siteEvents)
      .add({ type: "page_view", locale: "en", createdAt: now });
    await db()
      .collection(COLLECTIONS.siteEvents)
      .add({
        type: "page_view",
        locale: "en",
        createdAt: new Date("2020-01-01T00:00:00Z"),
      });

    const all = await getAdminStats({
      from: null,
      to: new Date(now.getTime() + 1000),
    });
    const recent = await getAdminStats({
      from: new Date(now.getTime() - 60_000),
      to: new Date(now.getTime() + 1000),
    });
    expect(all.visits! - recent.visits!).toBeGreaterThanOrEqual(1); // the 2020 visit is outside the range
    expect(recent.visits).toBeGreaterThanOrEqual(1);
    expect(all.users.farmers).toBeGreaterThanOrEqual(1);
    expect(all.users.consumers).toBeGreaterThanOrEqual(1);
    expect(all.products.active).toBeGreaterThanOrEqual(1);
    expect(all.reportsAwaiting).not.toBeNull();
    expect(all.accounts.blocked).not.toBeNull();
    // Every figure loaded (no nulls) against the emulator.
    expect(JSON.stringify(all)).not.toContain("null");
  });

  it("finds accounts by email, phone and name, with filters", async () => {
    const byEmail = await listUsers({ role: "farmer", q: farmer.email });
    expect(byEmail.items.map((u) => u.uid)).toEqual([farmer.uid]);
    const byPhone = await listUsers({
      role: "consumer",
      q: buyer.phone.slice(4),
    });
    expect(byPhone.items.map((u) => u.uid)).toEqual([buyer.uid]);
    const byName = await listUsers({ role: "farmer", q: "aminath" });
    expect(byName.items.map((u) => u.uid)).toContain(farmer.uid);
    expect(byName.items[0].farm?.farmName.en).toContain("Aminath Farm");
    // Wrong role → not listed.
    expect(
      (await listUsers({ role: "consumer", q: farmer.email })).items,
    ).toEqual([]);
    const approved = await listUsers({ role: "farmer", approval: "approved" });
    expect(
      approved.items.every((u) => u.farm?.approvalStatus === "approved"),
    ).toBe(true);
  });
});
