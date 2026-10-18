import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import type { ProductInput } from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import type { CatalogFilters } from "@/features/catalog/filters";
import { searchProductsLive } from "@/features/catalog/search";
import { setFarmerApproval } from "@/services/server/admin";
import {
  getConsumerOverview,
  listConsumerEnquiries,
  listConsumerFavourites,
  listConsumerFinance,
  listConsumerReports,
} from "@/services/server/consumer";
import { completeRegistration } from "@/services/server/registration";
import {
  getMyAccount,
  getMyConsumerProfile,
  saveMySettings,
} from "@/services/client/account";
import {
  addFavourite,
  isFavourite,
  removeFavourite,
  sendEnquiry,
  setEnquiryStatus,
} from "@/services/client/interactions";
import { submitReport } from "@/services/server/reports";
import { createProduct, newProductId } from "@/services/client/products";

/**
 * Buyer flows and live search against the emulators, with Security Rules
 * enforced: the real browser services signed in as real users, and the
 * server services the account pages use.
 */

const PASSWORD = "correct-horse-battery";
const admin = {
  uid: "admin-actor",
  role: "admin",
  adminLevel: "owner" as const,
};
// A unique island keeps this suite's search results apart from other suites'.
const RUN = randomUUID().slice(0, 8);
const ISLAND = `aa-srch-${RUN}`;
const LOCATION = { atollCode: "AA", islandId: ISLAND } as const;
// A made-up word that only this run's titles contain.
const WORD = `zq${RUN.replace(/[^a-z]/g, "x")}`;

const base: ProductInput = {
  title: { en: "" },
  category: "vegetables",
  unit: "kg",
  priceLaari: 1000,
  quantityAvailable: 10,
  imagePaths: [],
  deliveryDestinations: [{ atollCode: "AA" }],
  status: "active",
};

async function registerUser(role: "farmer" | "consumer", name: string) {
  const email = `${role}-${randomUUID()}@example.test`;
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
          phone: "777 1234",
          farmName: { en: `Farm ${RUN}` },
          location: LOCATION,
        }
      : {
          role,
          displayName: name,
          preferredLocale: "en",
          acceptTerms: true,
          phone: "7654321",
        },
  );
  return { uid, email };
}

async function signInAs(email: string) {
  await signOut(getClientAuth()).catch(() => undefined);
  await signInWithEmailAndPassword(getClientAuth(), email, PASSWORD);
  await getClientAuth().currentUser!.getIdToken(true);
}

const search = (f: Partial<CatalogFilters>, after?: string, size?: number) =>
  searchProductsLive(
    { sort: "newest", page: 1, island: ISLAND, ...f },
    after,
    size,
  );
const ids = (r: { products: { id: string }[] }) => r.products.map((p) => p.id);

let farmer: { uid: string; email: string };
let buyer: { uid: string; email: string };
let otherBuyer: { uid: string; email: string };
const p: Record<"fresh" | "cherry" | "chilli" | "hidden", string> = {
  fresh: "",
  cherry: "",
  chilli: "",
  hidden: "",
};

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  await getAdminDb()
    .collection(COLLECTIONS.islands)
    .doc(ISLAND)
    .set({ atollCode: "AA", nameEn: `Search Island ${RUN}`, active: true });
  farmer = await registerUser("farmer", "Mariyam");
  buyer = await registerUser("consumer", "Hassan");
  otherBuyer = await registerUser("consumer", "Ibrahim");
  await setFarmerApproval(admin, farmer.uid, "approved");

  // Created oldest → newest.
  await signInAs(farmer.email);
  p.fresh = await createProduct(newProductId(), {
    ...base,
    title: { en: `Fresh Tomato ${WORD}`, dv: "ފްރެޝް ޓޮމާޓޯ" },
    priceLaari: 1500,
    deliveryDestinations: [{ atollCode: "AA" }, { atollCode: "HDH" }],
  });
  p.cherry = await createProduct(newProductId(), {
    ...base,
    title: { en: `Cherry Tomato ${WORD}` },
    priceLaari: 3000,
  });
  p.chilli = await createProduct(newProductId(), {
    ...base,
    title: { en: `Chilli ${WORD}`, dv: "މިރުސް" },
    category: "herbs_spices",
    priceLaari: 800,
    status: "sold_out",
    quantityAvailable: 0,
  });
  p.hidden = await createProduct(newProductId(), {
    ...base,
    title: { en: `Hidden Tomato ${WORD}` },
    status: "draft",
  });
});

afterAll(async () => {
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("live search (Firestore queries)", () => {
  it("lists only public products, newest first, with an exact count", async () => {
    const r = await search({});
    expect(ids(r)).toEqual([p.chilli, p.cherry, p.fresh]);
    expect(r.total).toBe(3);
    expect(r.nextCursor).toBeNull();
  });

  it("matches English word prefixes", async () => {
    expect(ids(await search({ q: "tom" }))).toEqual([p.cherry, p.fresh]);
    expect(ids(await search({ q: WORD.slice(0, 6) }))).toHaveLength(3);
  });

  it("matches Dhivehi words", async () => {
    expect(ids(await search({ q: "ޓޮމާ" }))).toEqual([p.fresh]);
    expect(ids(await search({ q: "މިރުސް" }))).toEqual([p.chilli]);
  });

  it("requires every word, checking extra words in memory (no exact count)", async () => {
    const r = await search({ q: "tomato cher" });
    expect(ids(r)).toEqual([p.cherry]);
    expect(r.total).toBeNull();
  });

  it("filters by category and availability", async () => {
    expect(ids(await search({ category: "herbs_spices" }))).toEqual([p.chilli]);
    expect(ids(await search({ availableNow: true }))).toEqual([
      p.cherry,
      p.fresh,
    ]);
  });

  it("filters by price range with every sort order", async () => {
    const range = { minPriceLaari: 1000, maxPriceLaari: 3000 };
    expect(ids(await search({ ...range, sort: "price_asc" }))).toEqual([
      p.fresh,
      p.cherry,
    ]);
    expect(ids(await search({ ...range, sort: "price_desc" }))).toEqual([
      p.cherry,
      p.fresh,
    ]);
    const newest = await search(range);
    expect(ids(newest)).toEqual([p.cherry, p.fresh]);
    expect(newest.total).toBeNull();
  });

  it("sorts by price", async () => {
    expect(ids(await search({ sort: "price_asc" }))).toEqual([
      p.chilli,
      p.fresh,
      p.cherry,
    ]);
  });

  it("filters by delivery destination, alone and with a search word", async () => {
    expect(ids(await search({ deliverTo: "HDH" }))).toEqual([p.fresh]);
    expect(ids(await search({ deliverTo: "HDH", q: "tomato" }))).toEqual([
      p.fresh,
    ]);
  });

  it("pages with a cursor without repeats or gaps", async () => {
    const first = await search({}, undefined, 2);
    expect(ids(first)).toEqual([p.chilli, p.cherry]);
    expect(first.nextCursor).toBe(p.cherry);
    const second = await search({}, first.nextCursor!, 2);
    expect(ids(second)).toEqual([p.fresh]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBeNull(); // counts only on the first page
  });
});

describe("buyer flows", () => {
  it("saves and unsaves products and farms", async () => {
    await signInAs(buyer.email);
    await addFavourite("product", p.fresh);
    await addFavourite("product", p.hidden);
    await addFavourite("farmer", farmer.uid);
    expect(await isFavourite("product", p.fresh)).toBe(true);

    const saved = await listConsumerFavourites(buyer.uid);
    const byId = new Map(saved.products.map((s) => [s.productId, s]));
    expect(byId.get(p.fresh)?.listing?.id).toBe(p.fresh);
    // Non-public products resolve to "no longer available", without details.
    expect(byId.get(p.hidden)?.listing).toBeNull();
    expect(saved.farms.map((f) => f.farm?.id)).toEqual([farmer.uid]);

    // Another buyer's list is separate.
    expect((await listConsumerFavourites(otherBuyer.uid)).products).toEqual([]);

    await removeFavourite("product", p.hidden);
    expect(await isFavourite("product", p.hidden)).toBe(false);
  });

  it("sends an enquiry, sharing contact details only when chosen, and can cancel it", async () => {
    await signInAs(buyer.email);
    const withContact = await sendEnquiry({
      productId: p.fresh,
      quantity: 3,
      message: "Need it by Friday",
      consumerName: "Hassan",
      consumerPhone: "7654321",
      deliverTo: { atollCode: "AA", islandId: ISLAND },
    });
    const anonymous = await sendEnquiry({
      productId: p.cherry,
      quantity: 1,
      deliverTo: { atollCode: "AA", islandId: ISLAND },
    });

    const mine = await listConsumerEnquiries(buyer.uid);
    const a = mine.find((e) => e.id === withContact)!;
    expect(a).toMatchObject({
      status: "new",
      consumerPhone: "+9607654321",
      farmName: { en: `Farm ${RUN}` },
    });
    expect(a.product?.title.en).toContain("Fresh Tomato");
    expect(a.deliverToPlace.islandEn).toBe(`Search Island ${RUN}`);
    expect(mine.find((e) => e.id === anonymous)?.consumerPhone).toBeUndefined();

    await setEnquiryStatus(anonymous, "cancelled");
    expect(
      (await listConsumerEnquiries(buyer.uid)).find((e) => e.id === anonymous)
        ?.status,
    ).toBe("cancelled");

    // The farmer can't revive a cancelled enquiry.
    await signInAs(farmer.email);
    await expect(setEnquiryStatus(anonymous, "accepted")).rejects.toThrow();
  });

  it("cannot enquire about a non-public product or their own", async () => {
    await signInAs(buyer.email);
    await expect(
      sendEnquiry({
        productId: p.hidden,
        quantity: 1,
        deliverTo: { atollCode: "AA", islandId: ISLAND },
      }),
    ).rejects.toThrow();
    await signInAs(farmer.email);
    await expect(
      sendEnquiry({
        productId: p.fresh,
        quantity: 1,
        deliverTo: { atollCode: "AA", islandId: ISLAND },
      }),
    ).rejects.toThrow();
  });

  it("reports a product and a farm, and sees only their own reports", async () => {
    await signInAs(buyer.email);
    await submitReport(
      { uid: buyer.uid, role: "consumer" },
      {
        targetType: "product",
        targetId: p.cherry,
        reason: "wrong_price_or_quantity",
        details: "Price on the listing is wrong.",
      },
    );
    await submitReport(
      { uid: buyer.uid, role: "consumer" },
      {
        targetType: "farmer",
        targetId: farmer.uid,
        reason: "non_delivery",
        details: "Paid but never delivered.",
      },
    );
    const reports = await listConsumerReports(buyer.uid);
    expect(reports.map((r) => r.targetLabel?.en)).toEqual([
      `Farm ${RUN}`,
      expect.stringContaining("Cherry Tomato"),
    ]);
    expect(reports.every((r) => r.handledBy === undefined)).toBe(true);
    expect(await listConsumerReports(otherBuyer.uid)).toEqual([]);
  });

  it("shows issued invoices and payments to the linked buyer only", async () => {
    const db = getAdminDb();
    const now = new Date();
    const invoice = (status: string, number: string) => ({
      number,
      farmerId: farmer.uid,
      consumerId: buyer.uid,
      buyerName: "Hassan",
      lines: [
        {
          productId: p.fresh,
          title: "Fresh Tomato",
          unit: "kg",
          quantity: 2,
          unitPriceLaari: 1500,
          totalLaari: 3000,
        },
      ],
      subtotalLaari: 3000,
      deliveryFeeLaari: 0,
      totalLaari: 3000,
      paidLaari: 1000,
      status,
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const issued = db.collection(COLLECTIONS.invoices).doc();
    await issued.set(invoice("partially_paid", `INV-${RUN}`));
    await db
      .collection(COLLECTIONS.invoices)
      .doc()
      .set(invoice("draft", `DRAFT-${RUN}`));
    const payment = db.collection(COLLECTIONS.payments).doc();
    await payment.set({
      invoiceId: issued.id,
      farmerId: farmer.uid,
      consumerId: buyer.uid,
      amountLaari: 1000,
      method: "cash",
      receivedAt: now,
      recordedBy: farmer.uid,
      verificationStatus: "unverified",
      createdAt: now,
      updatedAt: now,
    });

    const mine = await listConsumerFinance(buyer.uid);
    expect(mine.invoices.map((i) => i.number)).toEqual([`INV-${RUN}`]); // drafts hidden
    expect(mine.invoices[0].farmName).toEqual({ en: `Farm ${RUN}` });
    expect(mine.payments.map((x) => x.invoiceNumber)).toEqual([`INV-${RUN}`]);

    const theirs = await listConsumerFinance(otherBuyer.uid);
    expect(theirs).toEqual({ invoices: [], payments: [] });

    // Security Rules agree: another buyer can't read them directly.
    await signInAs(otherBuyer.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.invoices, issued.id)),
    ).rejects.toThrow();
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.payments, payment.id)),
    ).rejects.toThrow();
  });

  it("keeps other people's enquiries and private profiles unreadable", async () => {
    const [enquiry] = await listConsumerEnquiries(buyer.uid);
    await signInAs(otherBuyer.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.enquiries, enquiry.id)),
    ).rejects.toThrow();
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.users, farmer.uid)),
    ).rejects.toThrow();
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.consumerProfiles, buyer.uid)),
    ).rejects.toThrow();
  });

  it("counts the buyer's own records for the overview", async () => {
    expect(await getConsumerOverview(buyer.uid)).toEqual({
      favourites: 2, // fresh tomato + the farm
      openEnquiries: 1, // the other was cancelled
      invoices: 1, // draft excluded
      openReports: 2,
    });
  });

  it("saves settings: preferred island, marketing opt-in, clearing the phone", async () => {
    await signInAs(buyer.email);
    await saveMySettings(
      { displayName: "Hassan Ali", preferredLocale: "dv" },
      {
        clearPhone: true,
        consumer: { marketingOptIn: true, defaultDeliveryLocation: LOCATION },
      },
    );
    const account = await getMyAccount();
    expect(account).toMatchObject({
      displayName: "Hassan Ali",
      preferredLocale: "dv",
    });
    expect(account?.phone).toBeUndefined();
    expect(await getMyConsumerProfile()).toMatchObject({
      marketingOptIn: true,
      defaultDeliveryLocation: LOCATION,
    });
  });
});
