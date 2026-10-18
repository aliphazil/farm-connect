import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  buildEnquiryCreate,
  buildFavourite,
  buildProductCreate,
  buildProductUpdate,
  buildReportCreate,
  buildUserUpdate,
} from "@shared/payloads";
import { productDerivedFields } from "@shared/schemas";
import {
  emulatorHost,
  LOCATION_AA,
  LOCATION_HDH,
  PRODUCT_INPUT,
  PROJECT_ID,
} from "../support/fixtures";

/**
 * Security Rules tests against the Firestore emulator.
 *
 * Cast:
 *   farmerA   — approved, visible farm (AA. Thoddoo)
 *   farmerB   — farm pending approval
 *   consumerC — ordinary buyer
 *   blockedD  — users/{uid}.status = "blocked", but the token claim hasn't caught up yet
 *   adminE    — admin custom claim
 *   mallory   — users/{uid}.role says "admin" but has NO admin claim (spoof attempt)
 */

let env: RulesTestEnvironment;
type TestDb = ReturnType<
  ReturnType<RulesTestEnvironment["unauthenticatedContext"]>["firestore"]
>;
const ts = Timestamp.fromDate(new Date("2026-10-01T00:00:00Z"));

const asFarmerA = () =>
  env.authenticatedContext("farmerA", { role: "farmer" }).firestore();
const asFarmerB = () =>
  env.authenticatedContext("farmerB", { role: "farmer" }).firestore();
const asConsumerC = () =>
  env.authenticatedContext("consumerC", { role: "consumer" }).firestore();
const asBlockedD = () =>
  env.authenticatedContext("blockedD", { role: "farmer" }).firestore();
const asBlockedClaim = () =>
  env
    .authenticatedContext("consumerC", { role: "consumer", blocked: true })
    .firestore();
const asAdmin = () =>
  env.authenticatedContext("adminE", { role: "admin" }).firestore();
const asMallory = () =>
  env.authenticatedContext("mallory", { role: "consumer" }).firestore();
const asAnon = () => env.unauthenticatedContext().firestore();

const farmA = {
  location: LOCATION_AA,
  approvalStatus: "approved" as const,
  visible: true,
};
const farmB = {
  location: LOCATION_HDH,
  approvalStatus: "pending" as const,
  visible: true,
};

function user(role: string, status = "active") {
  return {
    role,
    status,
    displayName: role,
    preferredLocale: "en",
    createdAt: ts,
    updatedAt: ts,
  };
}
function farmerProfile(location: object, approvalStatus: string) {
  return {
    farmName: { en: "Farm" },
    location,
    contact: { phone: "+9607771234" },
    deliveryDestinations: [],
    approvalStatus,
    verified: false,
    visible: true,
    pickupAvailable: false,
    createdAt: ts,
    updatedAt: ts,
  };
}
function product(
  farmerId: string,
  location: { atollCode: string; islandId: string },
  extra: Partial<Record<string, unknown>> = {},
) {
  const base = {
    ...PRODUCT_INPUT,
    farmerId,
    location,
    moderation: "ok",
    farmerVisible: true,
    ...extra,
  } as Parameters<typeof productDerivedFields>[0] & Record<string, unknown>;
  return {
    ...base,
    ...productDerivedFields(base),
    createdAt: ts,
    updatedAt: ts,
  };
}
/** Current values of a seeded product, as the client service reads them. */
const current = (extra: Partial<Record<string, unknown>> = {}) =>
  ({
    status: "active",
    moderation: "ok",
    title: PRODUCT_INPUT.title,
    deliveryDestinations: PRODUCT_INPUT.deliveryDestinations,
    ...extra,
  }) as never;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(
        join(__dirname, "../../firebase/firestore.rules"),
        "utf8",
      ),
      ...emulatorHost("FIRESTORE_EMULATOR_HOST"),
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const seed: [string, object][] = [
      ["users/farmerA", user("farmer")],
      ["users/farmerB", user("farmer")],
      ["users/consumerC", user("consumer")],
      ["users/blockedD", user("farmer", "blocked")],
      ["users/adminE", user("admin")],
      ["users/mallory", user("admin")],
      ["farmerProfiles/farmerA", farmerProfile(LOCATION_AA, "approved")],
      ["farmerProfiles/farmerB", farmerProfile(LOCATION_HDH, "pending")],
      ["farmerProfiles/blockedD", farmerProfile(LOCATION_AA, "approved")],
      [
        "consumerProfiles/consumerC",
        { marketingOptIn: false, createdAt: ts, updatedAt: ts },
      ],
      ["products/pA", product("farmerA", LOCATION_AA)],
      ["products/pDraft", product("farmerA", LOCATION_AA, { status: "draft" })],
      [
        "products/pRemoved",
        product("farmerA", LOCATION_AA, { moderation: "removed" }),
      ],
      [
        "products/pB",
        product("farmerB", LOCATION_HDH, { farmerVisible: false }),
      ],
      [
        "enquiries/e1",
        {
          productId: "pA",
          farmerId: "farmerA",
          consumerId: "consumerC",
          quantity: 2,
          deliverTo: LOCATION_AA,
          status: "new",
          createdAt: ts,
          updatedAt: ts,
        },
      ],
      [
        "reports/r1",
        {
          reporterId: "consumerC",
          targetType: "product",
          targetId: "pA",
          reason: "fake_listing",
          details: "This listing looks fake to me.",
          status: "open",
          createdAt: ts,
          updatedAt: ts,
        },
      ],
      [
        "invoices/i1",
        {
          farmerId: "farmerA",
          consumerId: "consumerC",
          number: "INV-0001",
          totalLaari: 5000,
        },
      ],
      [
        "payments/pay1",
        {
          farmerId: "farmerA",
          consumerId: "consumerC",
          invoiceId: "i1",
          verificationStatus: "unverified",
        },
      ],
      [
        "orders/o1",
        { farmerId: "farmerA", consumerId: "consumerC", status: "pending" },
      ],
      [
        "receipts/rc1",
        { farmerId: "farmerA", consumerId: "consumerC", amountLaari: 5000 },
      ],
      [
        "adminLogs/l1",
        {
          actorId: "adminE",
          action: "user.block",
          targetType: "user",
          targetId: "x",
          createdAt: ts,
        },
      ],
      [
        "moderationActions/m1",
        {
          actorId: "adminE",
          action: "user.block",
          targetType: "user",
          targetId: "x",
          createdAt: ts,
        },
      ],
      ["analyticsDaily/2026-10-01", { date: "2026-10-01", counts: {} }],
      ["siteSettings/branding", { primaryColor: "#15803d" }],
      ["siteContent/about_en", { published: true, title: "About" }],
      ["siteContent/terms_en", { published: false, title: "Terms" }],
      ["categories/fruits", { label: { en: "Fruits" }, active: true }],
      [
        "islands/aa-thoddoo",
        { atollCode: "AA", nameEn: "Thoddoo", active: true },
      ],
      [
        "islands/hdh-hanimaadhoo",
        { atollCode: "HDH", nameEn: "Hanimaadhoo", active: true },
      ],
    ];
    for (const [path, data] of seed) await setDoc(doc(db, path), data);
  });
});

describe("users", () => {
  it("are private to their owner and admins", async () => {
    await assertFails(getDoc(doc(asAnon(), "users/farmerA")));
    await assertFails(getDoc(doc(asConsumerC(), "users/farmerA")));
    await assertSucceeds(getDoc(doc(asFarmerA(), "users/farmerA")));
    await assertSucceeds(getDoc(doc(asAdmin(), "users/farmerA")));
  });

  it("let owners edit only permitted fields", async () => {
    const db = asFarmerA();
    await assertSucceeds(
      updateDoc(
        doc(db, "users/farmerA"),
        buildUserUpdate(
          { displayName: "Ali", phone: "777 1234" },
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(db, "users/farmerA"), {
        role: "admin",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "users/farmerA"), {
        status: "blocked",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "users/farmerA"), {
        email: "x@y.mv",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "users/farmerA"), { displayName: "No timestamp" }),
    );
    await assertFails(
      updateDoc(
        doc(asConsumerC(), "users/farmerA"),
        buildUserUpdate({ displayName: "Hacked" }, serverTimestamp()),
      ),
    );
  });

  it("can't be created or deleted by clients (server does registration)", async () => {
    const db = env.authenticatedContext("newbie", {}).firestore();
    await assertFails(setDoc(doc(db, "users/newbie"), user("admin")));
    await assertFails(setDoc(doc(db, "users/newbie"), user("consumer")));
    await assertFails(deleteDoc(doc(asFarmerA(), "users/farmerA")));
  });

  it("block writes for blocked accounts, even before the claim updates", async () => {
    await assertFails(
      updateDoc(
        doc(asBlockedD(), "users/blockedD"),
        buildUserUpdate({ displayName: "x" }, serverTimestamp()),
      ),
    );
    await assertFails(
      updateDoc(
        doc(asBlockedClaim(), "users/consumerC"),
        buildUserUpdate({ displayName: "x" }, serverTimestamp()),
      ),
    );
  });
});

describe("admin privileges", () => {
  it("come only from the custom claim, never from users/{uid}.role", async () => {
    // mallory's Firestore document says admin; her token does not.
    await assertFails(getDoc(doc(asMallory(), "adminLogs/l1")));
    await assertFails(getDoc(doc(asMallory(), "users/farmerA")));
    await assertSucceeds(getDoc(doc(asAdmin(), "adminLogs/l1")));
  });

  it("do not allow client-side writes to privileged collections, even for admins", async () => {
    const db = asAdmin();
    await assertFails(
      updateDoc(doc(db, "users/farmerA"), { status: "blocked" }),
    );
    await assertFails(
      updateDoc(doc(db, "farmerProfiles/farmerB"), {
        approvalStatus: "approved",
      }),
    );
    await assertFails(
      updateDoc(doc(db, "payments/pay1"), { verificationStatus: "verified" }),
    );
    await assertFails(
      setDoc(doc(db, "siteSettings/branding"), { primaryColor: "#000000" }),
    );
    await assertFails(
      addDoc(collection(db, "adminLogs"), { action: "user.block" }),
    );
  });
});

describe("farmerProfiles", () => {
  it("are public only when approved and visible", async () => {
    await assertSucceeds(getDoc(doc(asAnon(), "farmerProfiles/farmerA")));
    await assertFails(getDoc(doc(asAnon(), "farmerProfiles/farmerB")));
    await assertSucceeds(getDoc(doc(asFarmerB(), "farmerProfiles/farmerB")));
    await assertSucceeds(getDoc(doc(asAdmin(), "farmerProfiles/farmerB")));
  });

  it("let owners edit descriptive fields but not approval or visibility", async () => {
    const ref = doc(asFarmerA(), "farmerProfiles/farmerA");
    await assertSucceeds(
      updateDoc(ref, {
        farmName: { en: "Green Fields" },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(asFarmerB(), "farmerProfiles/farmerB"), {
        approvalStatus: "approved",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, { verified: true, updatedAt: serverTimestamp() }),
    );
    await assertFails(
      updateDoc(ref, { visible: false, updatedAt: serverTimestamp() }),
    );
    // Re-publishing a farm hidden by an admin must be impossible too.
    await assertFails(
      updateDoc(doc(asFarmerB(), "farmerProfiles/farmerB"), {
        visible: false,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        contact: { phone: "12345" },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(ref, {
        logoPath: "farmers/farmerB/logo.png",
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("can't be edited by other users", async () => {
    await assertFails(
      updateDoc(doc(asFarmerB(), "farmerProfiles/farmerA"), {
        farmName: { en: "Mine" },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(asConsumerC(), "farmerProfiles/farmerA"), {
        farmName: { en: "Mine" },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      setDoc(
        doc(asConsumerC(), "farmerProfiles/consumerC"),
        farmerProfile(LOCATION_AA, "approved"),
      ),
    );
  });
});

describe("consumerProfiles", () => {
  it("are private and owner-editable within limits", async () => {
    await assertSucceeds(
      getDoc(doc(asConsumerC(), "consumerProfiles/consumerC")),
    );
    await assertFails(getDoc(doc(asFarmerA(), "consumerProfiles/consumerC")));
    await assertSucceeds(
      updateDoc(doc(asConsumerC(), "consumerProfiles/consumerC"), {
        marketingOptIn: true,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(asConsumerC(), "consumerProfiles/consumerC"), {
        role: "admin",
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe("products: public reads", () => {
  it("expose only published products of public farms", async () => {
    const anon = asAnon();
    await assertSucceeds(getDoc(doc(anon, "products/pA")));
    await assertFails(getDoc(doc(anon, "products/pDraft")));
    await assertFails(getDoc(doc(anon, "products/pRemoved")));
    await assertFails(getDoc(doc(anon, "products/pB")));
  });

  it("allow the public catalog query but not an unfiltered one", async () => {
    const anon = asAnon();
    await assertSucceeds(
      getDocs(
        query(
          collection(anon, "products"),
          where("status", "in", ["active", "sold_out"]),
          where("moderation", "==", "ok"),
          where("farmerVisible", "==", true),
        ),
      ),
    );
    await assertFails(getDocs(collection(anon, "products")));
  });

  it("let farmers read all their own products", async () => {
    await assertSucceeds(getDoc(doc(asFarmerA(), "products/pDraft")));
    await assertSucceeds(getDoc(doc(asFarmerA(), "products/pRemoved")));
    await assertSucceeds(
      getDocs(
        query(
          collection(asFarmerB(), "products"),
          where("farmerId", "==", "farmerB"),
        ),
      ),
    );
    await assertFails(getDoc(doc(asFarmerB(), "products/pDraft")));
  });
});

describe("products: farmer writes", () => {
  it("let an approved farmer create their own product", async () => {
    await assertSucceeds(
      addDoc(
        collection(asFarmerA(), "products"),
        buildProductCreate(PRODUCT_INPUT, farmA, "farmerA", serverTimestamp()),
      ),
    );
  });

  it("let a pending farmer create only non-public products", async () => {
    const db = asFarmerB();
    await assertSucceeds(
      addDoc(
        collection(db, "products"),
        buildProductCreate(PRODUCT_INPUT, farmB, "farmerB", serverTimestamp()),
      ),
    );
    // Claiming the farm is public when it isn't:
    await assertFails(
      addDoc(
        collection(db, "products"),
        buildProductCreate(
          PRODUCT_INPUT,
          { ...farmB, approvalStatus: "approved" },
          "farmerB",
          serverTimestamp(),
        ),
      ),
    );
  });

  it("reject forged ownership, moderation, location and invalid data", async () => {
    const db = asFarmerA();
    const good = buildProductCreate(
      PRODUCT_INPUT,
      farmA,
      "farmerA",
      serverTimestamp(),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, farmerId: "farmerB" }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, moderation: "removed" }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, location: LOCATION_HDH }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, priceLaari: 0 }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, priceLaari: 25.5 }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, status: "removed" }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, featured: true }),
    );
    await assertFails(
      addDoc(collection(db, "products"), { ...good, createdAt: ts }),
    );
  });

  it("deny product creation to consumers, anonymous and blocked users", async () => {
    await assertFails(
      addDoc(
        collection(asConsumerC(), "products"),
        buildProductCreate(
          PRODUCT_INPUT,
          farmA,
          "consumerC",
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      addDoc(
        collection(asAnon(), "products"),
        buildProductCreate(PRODUCT_INPUT, farmA, "anon", serverTimestamp()),
      ),
    );
    await assertFails(
      addDoc(
        collection(asBlockedD(), "products"),
        buildProductCreate(PRODUCT_INPUT, farmA, "blockedD", serverTimestamp()),
      ),
    );
  });

  it("let farmers update only their own, unmoderated products", async () => {
    const db = asFarmerA();
    await assertSucceeds(
      updateDoc(
        doc(db, "products/pA"),
        buildProductUpdate(
          { priceLaari: 3000 },
          farmA,
          current(),
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      updateDoc(
        doc(db, "products/pB"),
        buildProductUpdate(
          { priceLaari: 1 },
          farmA,
          current(),
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      updateDoc(
        doc(db, "products/pRemoved"),
        buildProductUpdate(
          { priceLaari: 1 },
          farmA,
          current(),
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(db, "products/pA"), {
        moderation: "removed",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(db, "products/pA"), {
        farmerId: "farmerB",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(asConsumerC(), "products/pA"), {
        priceLaari: 1,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("let farmers delete their own products, but keep moderated ones", async () => {
    await assertFails(deleteDoc(doc(asConsumerC(), "products/pA")));
    await assertFails(deleteDoc(doc(asFarmerB(), "products/pA")));
    await assertFails(deleteDoc(doc(asFarmerA(), "products/pRemoved")));
    await assertSucceeds(deleteDoc(doc(asFarmerA(), "products/pA")));
  });
});

describe("products: derived search fields", () => {
  it("must be computed honestly", async () => {
    const db = asFarmerA();
    const good = buildProductCreate(
      { ...PRODUCT_INPUT, status: "draft" },
      farmA,
      "farmerA",
      serverTimestamp(),
    );
    await assertSucceeds(addDoc(collection(db, "products"), good));
    // A draft can't claim to be public.
    await assertFails(
      addDoc(collection(db, "products"), { ...good, isPublic: true }),
    );
    // Delivery atolls must include the farm's own atoll.
    await assertFails(
      addDoc(collection(db, "products"), { ...good, deliveryAtolls: ["K"] }),
    );
    // Token stuffing is capped.
    await assertFails(
      addDoc(collection(db, "products"), {
        ...good,
        searchTokens: Array.from({ length: 81 }, (_, i) => `t${i}`),
      }),
    );
    // Publishing without updating isPublic is rejected.
    await assertFails(
      updateDoc(doc(db, "products/pDraft"), {
        status: "active",
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(
      updateDoc(
        doc(db, "products/pDraft"),
        buildProductUpdate(
          { status: "active" },
          farmA,
          current({ status: "draft" }),
          serverTimestamp(),
        ),
      ),
    );
  });
});

describe("deliveryAreas", () => {
  const area = {
    atollCode: "K",
    method: "ferry",
    feeLaari: 5000,
    active: true,
  };
  it("are managed only by their farmer", async () => {
    const now = serverTimestamp();
    await assertSucceeds(
      addDoc(collection(asFarmerA(), "deliveryAreas"), {
        ...area,
        farmerId: "farmerA",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await assertFails(
      addDoc(collection(asFarmerA(), "deliveryAreas"), {
        ...area,
        farmerId: "farmerB",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await assertFails(
      addDoc(collection(asConsumerC(), "deliveryAreas"), {
        ...area,
        farmerId: "consumerC",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await assertFails(
      addDoc(collection(asFarmerA(), "deliveryAreas"), {
        ...area,
        atollCode: "XX",
        farmerId: "farmerA",
        createdAt: now,
        updatedAt: now,
      }),
    );
  });
});

describe("enquiries", () => {
  const input = { productId: "pA", quantity: 3, deliverTo: LOCATION_AA };

  it("let a member enquire about a public product", async () => {
    await assertSucceeds(
      addDoc(
        collection(asConsumerC(), "enquiries"),
        buildEnquiryCreate(
          input,
          { farmerId: "farmerA" },
          "consumerC",
          serverTimestamp(),
        ),
      ),
    );
    // Farmers may buy from other farmers.
    await assertSucceeds(
      addDoc(
        collection(asFarmerB(), "enquiries"),
        buildEnquiryCreate(
          input,
          { farmerId: "farmerA" },
          "farmerB",
          serverTimestamp(),
        ),
      ),
    );
  });

  it("reject forged, self-directed and non-public enquiries", async () => {
    const c = asConsumerC();
    const good = buildEnquiryCreate(
      input,
      { farmerId: "farmerA" },
      "consumerC",
      serverTimestamp(),
    );
    await assertFails(
      addDoc(collection(c, "enquiries"), { ...good, consumerId: "farmerB" }),
    );
    await assertFails(
      addDoc(collection(c, "enquiries"), { ...good, farmerId: "farmerB" }),
    );
    await assertFails(
      addDoc(collection(c, "enquiries"), { ...good, status: "accepted" }),
    );
    await assertFails(
      addDoc(collection(c, "enquiries"), {
        ...good,
        productId: "pB",
        farmerId: "farmerB",
      }),
    );
    await assertFails(
      addDoc(
        collection(asFarmerA(), "enquiries"),
        buildEnquiryCreate(
          input,
          { farmerId: "farmerA" },
          "farmerA",
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(addDoc(collection(asAnon(), "enquiries"), good));
  });

  it("are visible only to the two parties and admins", async () => {
    await assertSucceeds(getDoc(doc(asConsumerC(), "enquiries/e1")));
    await assertSucceeds(getDoc(doc(asFarmerA(), "enquiries/e1")));
    await assertSucceeds(getDoc(doc(asAdmin(), "enquiries/e1")));
    await assertFails(getDoc(doc(asFarmerB(), "enquiries/e1")));
  });

  it("follow the allowed status transitions", async () => {
    const set = (db: TestDb, status: string) =>
      updateDoc(doc(db, "enquiries/e1"), {
        status,
        updatedAt: serverTimestamp(),
      });
    await assertFails(set(asConsumerC(), "accepted"));
    await assertFails(set(asFarmerA(), "completed"));
    await assertFails(
      updateDoc(doc(asFarmerA(), "enquiries/e1"), {
        quantity: 100,
        updatedAt: serverTimestamp(),
      }),
    );
    await assertSucceeds(set(asFarmerA(), "accepted"));
    await assertSucceeds(set(asConsumerC(), "cancelled"));
    await assertFails(set(asFarmerA(), "completed"));
  });
});

describe("favourites", () => {
  it("are private, owner-managed and keyed by user+type+target", async () => {
    const c = asConsumerC();
    const fav = buildFavourite("consumerC", "product", "pA", serverTimestamp());
    await assertSucceeds(setDoc(doc(c, "favourites", fav.id), fav.data));
    await assertFails(setDoc(doc(c, "favourites", "random-id"), fav.data));
    const forged = buildFavourite(
      "farmerA",
      "product",
      "pA",
      serverTimestamp(),
    );
    await assertFails(setDoc(doc(c, "favourites", forged.id), forged.data));
    await assertSucceeds(
      getDocs(
        query(collection(c, "favourites"), where("userId", "==", "consumerC")),
      ),
    );
    await assertFails(
      getDocs(
        query(
          collection(asFarmerA(), "favourites"),
          where("userId", "==", "consumerC"),
        ),
      ),
    );
    await assertSucceeds(deleteDoc(doc(c, "favourites", fav.id)));
  });

  it("can save farms, but only ones that exist", async () => {
    const c = asConsumerC();
    const farm = buildFavourite(
      "consumerC",
      "farmer",
      "farmerA",
      serverTimestamp(),
    );
    await assertSucceeds(setDoc(doc(c, "favourites", farm.id), farm.data));
    const ghost = buildFavourite(
      "consumerC",
      "farmer",
      "no-such-farm",
      serverTimestamp(),
    );
    await assertFails(setDoc(doc(c, "favourites", ghost.id), ghost.data));
    const weird = { ...farm.data, targetType: "user" };
    await assertFails(
      setDoc(doc(c, "favourites", "consumerC_user_farmerA"), weird),
    );
  });

  it("lets a user check an unsaved item without revealing others' saves", async () => {
    const mine = buildFavourite("consumerC", "product", "pB", null).id;
    await assertSucceeds(getDoc(doc(asConsumerC(), "favourites", mine)));
    // Another user can't learn whether consumerC saved something.
    await assertFails(getDoc(doc(asFarmerA(), "favourites", mine)));
    const saved = buildFavourite(
      "consumerC",
      "product",
      "pA",
      serverTimestamp(),
    );
    await assertSucceeds(
      setDoc(doc(asConsumerC(), "favourites", saved.id), saved.data),
    );
    await assertFails(getDoc(doc(asFarmerA(), "favourites", saved.id)));
  });

  it("can't be created by guests", async () => {
    const fav = buildFavourite("anon", "product", "pA", serverTimestamp());
    await assertFails(setDoc(doc(asAnon(), "favourites", fav.id), fav.data));
  });
});

describe("reports", () => {
  const input = {
    targetType: "product" as const,
    targetId: "pA",
    reason: "fraud_scam" as const,
    details: "Asked me to pay in advance and stopped answering.",
  };

  it("can't be written by any client (the server validates and creates them)", async () => {
    for (const [db, uid] of [
      [asConsumerC(), "consumerC"],
      [asFarmerA(), "farmerA"],
      [asAdmin(), "adminE"],
      [asAnon(), "anon"],
    ] as const) {
      await assertFails(
        addDoc(
          collection(db, "reports"),
          buildReportCreate(input, uid, serverTimestamp()),
        ),
      );
    }
  });

  it("are private to the reporter and admins — never the reported party", async () => {
    await assertSucceeds(getDoc(doc(asConsumerC(), "reports/r1")));
    await assertSucceeds(getDoc(doc(asAdmin(), "reports/r1")));
    // pA belongs to farmerA, the reported party.
    await assertFails(getDoc(doc(asFarmerA(), "reports/r1")));
    await assertFails(
      getDocs(
        query(
          collection(asFarmerA(), "reports"),
          where("targetId", "==", "pA"),
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(asConsumerC(), "reports/r1"), { status: "resolved" }),
    );
    await assertFails(
      updateDoc(doc(asAdmin(), "reports/r1"), { status: "resolved" }),
    );
  });

  it("internal notes are admin-only; messages are for the reporter and admins", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "reports/r1/notes/n1"), {
        authorId: "adminE",
        body: "Looks like a repeat offender",
        createdAt: ts,
      });
      await setDoc(doc(db, "reports/r1/messages/m1"), {
        author: "admin",
        authorId: "adminE",
        body: "Do you have a receipt?",
        createdAt: ts,
      });
    });
    await assertSucceeds(getDoc(doc(asAdmin(), "reports/r1/notes/n1")));
    await assertFails(getDoc(doc(asConsumerC(), "reports/r1/notes/n1")));
    await assertFails(getDoc(doc(asFarmerA(), "reports/r1/notes/n1")));
    await assertSucceeds(getDoc(doc(asConsumerC(), "reports/r1/messages/m1")));
    await assertSucceeds(getDoc(doc(asAdmin(), "reports/r1/messages/m1")));
    await assertFails(getDoc(doc(asFarmerA(), "reports/r1/messages/m1")));
    await assertFails(
      setDoc(doc(asConsumerC(), "reports/r1/messages/m2"), {
        author: "reporter",
        body: "hi",
      }),
    );
    await assertFails(
      setDoc(doc(asAdmin(), "reports/r1/notes/n2"), { body: "x" }),
    );
  });

  it("enforcement records and report guards aren't readable or writable by members", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "enforcementActions/a1"), {
        userId: "consumerC",
        type: "warning",
        reason: "Spam",
        internalNote: "secret",
        status: "active",
      });
      await setDoc(doc(db, "reportGuards/consumerC_product_pA"), {
        open: true,
      });
    });
    await assertSucceeds(getDoc(doc(asAdmin(), "enforcementActions/a1")));
    // Even the warned user reads it only through server code (no internal notes).
    await assertFails(getDoc(doc(asConsumerC(), "enforcementActions/a1")));
    await assertFails(
      updateDoc(doc(asConsumerC(), "enforcementActions/a1"), {
        "appeal.status": "overturned",
      }),
    );
    await assertFails(
      setDoc(doc(asAdmin(), "enforcementActions/a2"), { userId: "x" }),
    );
    await assertFails(
      getDoc(doc(asConsumerC(), "reportGuards/consumerC_product_pA")),
    );
    await assertFails(
      deleteDoc(doc(asConsumerC(), "reportGuards/consumerC_product_pA")),
    );
    await assertFails(
      setDoc(doc(asConsumerC(), "reportQuotas/consumerC"), { count: 0 }),
    );
  });
});

describe("financial records", () => {
  for (const path of [
    "invoices/i1",
    "payments/pay1",
    "orders/o1",
    "receipts/rc1",
  ]) {
    it(`${path.split("/")[0]} are private to the parties and admins, and server-written`, async () => {
      await assertSucceeds(getDoc(doc(asFarmerA(), path)));
      await assertSucceeds(getDoc(doc(asConsumerC(), path)));
      await assertSucceeds(getDoc(doc(asAdmin(), path)));
      await assertFails(getDoc(doc(asFarmerB(), path)));
      await assertFails(getDoc(doc(asAnon(), path)));
      await assertFails(updateDoc(doc(asFarmerA(), path), { totalLaari: 1 }));
      await assertFails(
        setDoc(doc(asFarmerA(), `${path}-new`), { farmerId: "farmerA" }),
      );
    });
  }
});

describe("admin-only and public reference data", () => {
  it("restrict logs and analytics to admins", async () => {
    for (const path of [
      "adminLogs/l1",
      "moderationActions/m1",
      "analyticsDaily/2026-10-01",
    ]) {
      await assertSucceeds(getDoc(doc(asAdmin(), path)));
      await assertFails(getDoc(doc(asFarmerA(), path)));
      await assertFails(getDoc(doc(asAnon(), path)));
    }
  });

  it("expose reference data and settings read-only", async () => {
    await assertSucceeds(getDoc(doc(asAnon(), "categories/fruits")));
    await assertSucceeds(getDoc(doc(asAnon(), "islands/aa-thoddoo")));
    await assertSucceeds(getDoc(doc(asAnon(), "siteSettings/branding")));
    await assertFails(
      setDoc(doc(asFarmerA(), "categories/fruits"), { active: false }),
    );
    await assertFails(
      setDoc(doc(asFarmerA(), "siteSettings/branding"), {
        primaryColor: "#000000",
      }),
    );
  });

  it("publish only published site content", async () => {
    await assertSucceeds(getDoc(doc(asAnon(), "siteContent/about_en")));
    await assertFails(getDoc(doc(asAnon(), "siteContent/terms_en")));
    await assertSucceeds(getDoc(doc(asAdmin(), "siteContent/terms_en")));
  });
});

describe("analytics data", () => {
  it("browsers can't write events or counters, or read them", async () => {
    // Events go through /api/events; the legacy collection is closed to writes.
    await assertFails(
      addDoc(collection(asAnon(), "siteEvents"), {
        type: "page_view",
        locale: "en",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(
      addDoc(collection(asConsumerC(), "siteEvents"), {
        type: "contact_click",
        locale: "en",
        channel: "whatsapp",
        createdAt: serverTimestamp(),
      }),
    );
    await assertFails(getDocs(collection(asConsumerC(), "siteEvents")));
    for (const path of [
      "analyticsDaily/2026-10-01/shards/0",
      "analyticsDaily/2026-10-01/hll/0",
      "analyticsProductDaily/2026-10-01_pA",
      "analyticsFarmerDaily/2026-10-01_farmerA",
      "analyticsMarks/abc",
    ]) {
      await assertFails(setDoc(doc(asAnon(), path), { counts: { x: 1 } }));
      await assertFails(setDoc(doc(asFarmerA(), path), { productViews: 999 }));
      await assertFails(getDoc(doc(asFarmerA(), path)));
      await assertFails(getDoc(doc(asConsumerC(), path)));
    }
    // A farmer can't read their own raw counters from the browser either;
    // their analytics page reads them on the server, filtered by session.
    await assertFails(
      getDocs(
        query(
          collection(asFarmerA(), "analyticsFarmerDaily"),
          where("farmerId", "==", "farmerA"),
        ),
      ),
    );
    await assertSucceeds(
      getDoc(doc(asAdmin(), "analyticsDaily/2026-10-01/shards/0")),
    );
    await assertFails(getDoc(doc(asAdmin(), "analyticsMarks/abc")));
  });
});

describe("admin phase: restrictions, suspension, listing review, location integrity", () => {
  const seed = (path: string, data: object) =>
    env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), path), data),
    );
  const restrict = (uid: string, role: string, restrictions: string[]) =>
    seed(`users/${uid}`, { ...user(role), restrictions });

  it("restricted features are refused by the rules, others still work", async () => {
    await restrict("consumerC", "consumer", ["enquiries"]);
    const enquiry = buildEnquiryCreate(
      { productId: "pA", quantity: 1, deliverTo: LOCATION_AA },
      { farmerId: "farmerA" },
      "consumerC",
      serverTimestamp(),
    );
    await assertFails(addDoc(collection(asConsumerC(), "enquiries"), enquiry));
    // (Reports are now created only by server code, which checks restrictions.)
    await assertFails(
      addDoc(
        collection(asConsumerC(), "reports"),
        buildReportCreate(
          {
            targetType: "product",
            targetId: "pA",
            reason: "other",
            details: "Something is off here.",
          },
          "consumerC",
          serverTimestamp(),
        ),
      ),
    );
    await restrict("consumerC", "consumer", ["reports"]);
    await assertFails(
      addDoc(
        collection(asConsumerC(), "reports"),
        buildReportCreate(
          {
            targetType: "product",
            targetId: "pA",
            reason: "other",
            details: "Something is off here.",
          },
          "consumerC",
          serverTimestamp(),
        ),
      ),
    );
    await assertSucceeds(
      addDoc(collection(asConsumerC(), "enquiries"), enquiry),
    );
  });

  it("a farmer with listings restricted can't publish but can pause", async () => {
    await restrict("farmerA", "farmer", ["listings"]);
    await assertFails(
      setDoc(
        doc(asFarmerA(), "products/new1"),
        buildProductCreate(PRODUCT_INPUT, farmA, "farmerA", serverTimestamp()),
      ),
    );
    await assertSucceeds(
      setDoc(
        doc(asFarmerA(), "products/new2"),
        buildProductCreate(
          { ...PRODUCT_INPUT, status: "draft" },
          farmA,
          "farmerA",
          serverTimestamp(),
        ),
      ),
    );
    await assertSucceeds(
      updateDoc(
        doc(asFarmerA(), "products/pA"),
        buildProductUpdate(
          { status: "paused" },
          farmA,
          current(),
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      updateDoc(
        doc(asFarmerA(), "products/pDraft"),
        buildProductUpdate(
          { status: "active" },
          farmA,
          current({ status: "draft" }),
          serverTimestamp(),
        ),
      ),
    );
  });

  it("suspended accounts can't write, even with a stale token", async () => {
    await seed("users/consumerC", user("consumer", "suspended"));
    await assertFails(
      addDoc(
        collection(asConsumerC(), "enquiries"),
        buildEnquiryCreate(
          { productId: "pA", quantity: 1, deliverTo: LOCATION_AA },
          { farmerId: "farmerA" },
          "consumerC",
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      setDoc(
        doc(
          asConsumerC(),
          "favourites",
          buildFavourite("consumerC", "product", "pA", null).id,
        ),
        buildFavourite("consumerC", "product", "pA", serverTimestamp()).data,
      ),
    );
  });

  it("with pre-approval on, new listings must start pending and stay hidden", async () => {
    await seed("siteSettings/moderation", { listingsRequireApproval: true });
    // The client must ask for "pending"; claiming "ok" is refused.
    await assertFails(
      setDoc(
        doc(asFarmerA(), "products/p1"),
        buildProductCreate(
          PRODUCT_INPUT,
          farmA,
          "farmerA",
          serverTimestamp(),
          false,
        ),
      ),
    );
    const pending = buildProductCreate(
      PRODUCT_INPUT,
      farmA,
      "farmerA",
      serverTimestamp(),
      true,
    );
    await assertSucceeds(setDoc(doc(asFarmerA(), "products/p1"), pending));
    // Not public, so buyers can't read it.
    await assertFails(getDoc(doc(asAnon(), "products/p1")));
    // The farmer can edit it while pending but can't approve it.
    await assertSucceeds(
      updateDoc(
        doc(asFarmerA(), "products/p1"),
        buildProductUpdate(
          { priceLaari: 3000 },
          farmA,
          current({ moderation: "pending" }),
          serverTimestamp(),
        ),
      ),
    );
    await assertFails(
      updateDoc(doc(asFarmerA(), "products/p1"), {
        moderation: "ok",
        isPublic: true,
        updatedAt: serverTimestamp(),
      }),
    );
  });

  it("with pre-approval off, a farmer can't create a pending listing", async () => {
    await assertFails(
      setDoc(
        doc(asFarmerA(), "products/p2"),
        buildProductCreate(
          PRODUCT_INPUT,
          farmA,
          "farmerA",
          serverTimestamp(),
          true,
        ),
      ),
    );
  });

  it("a rejected listing can only be resubmitted (→ pending), never self-approved", async () => {
    await seed(
      "products/pRej",
      product("farmerA", LOCATION_AA, {
        moderation: "rejected",
        moderationNote: "Blurry photos",
      }),
    );
    const ref = doc(asFarmerA(), "products/pRej");
    await assertFails(
      updateDoc(ref, {
        moderation: "ok",
        isPublic: true,
        updatedAt: serverTimestamp(),
      }),
    );
    // Clearing the admin's note isn't allowed.
    await assertFails(
      updateDoc(ref, {
        ...buildProductUpdate(
          { priceLaari: 2600 },
          farmA,
          current({ moderation: "rejected" }),
          serverTimestamp(),
        ),
        moderationNote: "",
      }),
    );
    await assertSucceeds(
      updateDoc(
        ref,
        buildProductUpdate(
          { priceLaari: 2600 },
          farmA,
          current({ moderation: "rejected" }),
          serverTimestamp(),
        ),
      ),
    );
    // Rejected/pending listings can be deleted; removed ones are kept as evidence.
    await assertSucceeds(deleteDoc(ref));
    await assertFails(deleteDoc(doc(asFarmerA(), "products/pRemoved")));
  });

  it("new listings can use every unit, including bundle", async () => {
    await assertSucceeds(
      setDoc(
        doc(asFarmerA(), "products/pBundle"),
        buildProductCreate(
          { ...PRODUCT_INPUT, unit: "bundle" },
          farmA,
          "farmerA",
          serverTimestamp(),
        ),
      ),
    );
  });

  it("locations must be real islands in the stated atoll", async () => {
    const ref = doc(asFarmerA(), "farmerProfiles/farmerA");
    await assertFails(
      updateDoc(ref, {
        location: { atollCode: "AA", islandId: "aa-nowhere" },
        updatedAt: serverTimestamp(),
      }),
    );
    // Island exists but belongs to another atoll.
    await assertFails(
      updateDoc(ref, {
        location: { atollCode: "AA", islandId: "hdh-hanimaadhoo" },
        updatedAt: serverTimestamp(),
      }),
    );
    await assertFails(
      addDoc(
        collection(asConsumerC(), "enquiries"),
        buildEnquiryCreate(
          {
            productId: "pA",
            quantity: 1,
            deliverTo: { atollCode: "K", islandId: "k-made-up" },
          },
          { farmerId: "farmerA" },
          "consumerC",
          serverTimestamp(),
        ),
      ),
    );
    const now = serverTimestamp();
    await assertFails(
      addDoc(collection(asFarmerA(), "deliveryAreas"), {
        atollCode: "HDH",
        islandId: "aa-thoddoo",
        method: "ferry",
        active: true,
        farmerId: "farmerA",
        createdAt: now,
        updatedAt: now,
      }),
    );
    await assertSucceeds(
      addDoc(collection(asFarmerA(), "deliveryAreas"), {
        atollCode: "HDH",
        islandId: "hdh-hanimaadhoo",
        method: "ferry",
        active: true,
        farmerId: "farmerA",
        createdAt: now,
        updatedAt: now,
      }),
    );
  });

  it("units are public reference data nobody can write from a browser", async () => {
    await seed("units/kg", { label: { en: "kg" }, active: true, sortOrder: 0 });
    await assertSucceeds(getDoc(doc(asAnon(), "units/kg")));
    await assertFails(setDoc(doc(asAdmin(), "units/kg"), { active: false }));
    await assertFails(
      setDoc(doc(asAdmin(), "siteSettings/moderation"), {
        listingsRequireApproval: true,
      }),
    );
    // Restrictions and suspensions are server-only fields.
    await assertFails(
      updateDoc(doc(asConsumerC(), "users/consumerC"), {
        restrictions: [],
        updatedAt: serverTimestamp(),
      }),
    );
    // A suspended user can't reactivate themselves.
    await seed("users/consumerC", user("consumer", "suspended"));
    await assertFails(
      updateDoc(doc(asConsumerC(), "users/consumerC"), {
        status: "active",
        updatedAt: serverTimestamp(),
      }),
    );
  });
});

describe("branding studio data", () => {
  it("drafts and versions are admin-only; published branding is public; clients write none", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "brandingDrafts/current"), {
        config: { identity: {} },
      });
      await setDoc(doc(db, "brandingVersions/000001"), {
        number: 1,
        config: {},
      });
    });
    await assertSucceeds(getDoc(doc(asAdmin(), "brandingDrafts/current")));
    await assertSucceeds(getDoc(doc(asAdmin(), "brandingVersions/000001")));
    for (const db of [asAnon(), asConsumerC(), asFarmerA(), asMallory()]) {
      await assertFails(getDoc(doc(db, "brandingDrafts/current")));
      await assertFails(getDoc(doc(db, "brandingVersions/000001")));
    }
    await assertSucceeds(getDoc(doc(asAnon(), "siteSettings/branding")));
    await assertFails(
      setDoc(doc(asAdmin(), "brandingDrafts/current"), { config: {} }),
    );
    await assertFails(
      setDoc(doc(asAdmin(), "siteSettings/branding"), { config: {} }),
    );
    await assertFails(
      setDoc(doc(asAdmin(), "brandingVersions/000002"), { number: 2 }),
    );
  });
});
