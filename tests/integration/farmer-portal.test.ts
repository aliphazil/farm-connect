import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import { buildEnquiryCreate } from "@shared/payloads";
import type { ProductInput } from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import {
  getClientAuth,
  getClientDb,
  getClientStorage,
} from "@/lib/firebase/client";
import { blockUser, setFarmerApproval } from "@/services/server/admin";
import {
  getFarmerDashboard,
  getFarmerProduct,
  listFarmerEnquiries,
} from "@/services/server/farmer";
import { completeRegistration } from "@/services/server/registration";
import {
  getMyFarmerProfile,
  updateMyFarmerProfile,
} from "@/services/client/account";
import { setEnquiryStatus } from "@/services/client/interactions";
import {
  createDeliveryArea,
  createProduct,
  deleteDeliveryArea,
  deleteProduct,
  newProductId,
  setProductQuantity,
  setProductStatus,
  syncProductsWithFarm,
  updateDeliveryArea,
  updateProduct,
} from "@/services/client/products";
import {
  checkImage,
  uploadFarmLogo,
  uploadProductImage,
} from "@/services/client/uploads";

/**
 * End-to-end farmer-portal data flows: the real browser services signed in as
 * real users, against the Auth + Firestore + Storage emulators, with the
 * project's Security Rules enforced.
 */

const PASSWORD = "correct-horse-battery";
const admin = {
  uid: "admin-actor",
  role: "admin",
  adminLevel: "owner" as const,
};
const LOCATION = { atollCode: "AA", islandId: "aa-thoddoo" } as const;
const OTHER_LOCATION = { atollCode: "AA", islandId: "aa-rasdhoo" } as const;
const JPEG = new Blob([new Uint8Array(2048)], { type: "image/jpeg" });

const input: ProductInput = {
  title: { en: "Papaya", dv: "ފަޅޯ" },
  category: "fruits",
  unit: "kg",
  priceLaari: 2500,
  quantityAvailable: 40,
  imagePaths: [],
  deliveryDestinations: [{ atollCode: "AA" }],
  status: "active",
  pickupAvailable: true,
  harvestDate: new Date("2026-10-10T00:00:00Z"),
};

async function registerUser(role: "farmer" | "consumer") {
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
          displayName: "Aisha",
          preferredLocale: "en",
          acceptTerms: true,
          phone: "777 1234",
          farmName: { dv: "ތޮއްޑޫ ދަނޑު", en: "" },
          location: LOCATION,
        }
      : {
          role,
          displayName: "Hassan",
          preferredLocale: "dv",
          acceptTerms: true,
          phone: "960 7654321",
        },
  );
  return { uid, email };
}

async function signInAs(email: string) {
  await signOut(getClientAuth()).catch(() => undefined);
  await signInWithEmailAndPassword(getClientAuth(), email, PASSWORD);
  // Refresh so the role claim set during registration is in the token.
  await getClientAuth().currentUser!.getIdToken(true);
}

let farmerA: { uid: string; email: string };
let farmerB: { uid: string; email: string };
let consumer: { uid: string; email: string };
let productB: string;

beforeAll(async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  const db = getAdminDb();
  await db
    .collection(COLLECTIONS.islands)
    .doc("aa-thoddoo")
    .set({ atollCode: "AA", nameEn: "Thoddoo", active: true });
  await db
    .collection(COLLECTIONS.islands)
    .doc("aa-rasdhoo")
    .set({ atollCode: "AA", nameEn: "Rasdhoo", active: true });
  farmerA = await registerUser("farmer");
  farmerB = await registerUser("farmer");
  consumer = await registerUser("consumer");
  await setFarmerApproval(admin, farmerA.uid, "approved");
  await setFarmerApproval(admin, farmerB.uid, "approved");

  await signInAs(farmerB.email);
  productB = await createProduct(newProductId(), input);
});

afterAll(async () => {
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("farmer onboarding data", () => {
  it("registration stores terms acceptance and a Dhivehi-only farm name", async () => {
    const user = (
      await getAdminDb().collection(COLLECTIONS.users).doc(farmerA.uid).get()
    ).data()!;
    expect(user.termsVersion).toBeTruthy();
    expect(user.termsAcceptedAt).toBeTruthy();
    const farm = (
      await getAdminDb()
        .collection(COLLECTIONS.farmerProfiles)
        .doc(farmerA.uid)
        .get()
    ).data()!;
    expect(farm.farmName).toEqual({ en: "", dv: "ތޮއްޑޫ ދަނޑު" });
    expect(farm.pickupAvailable).toBe(false);
  });

  it("lets the farmer complete their profile, including logo, map pin and pickup", async () => {
    await signInAs(farmerA.email);
    const logoPath = await uploadFarmLogo(JPEG);
    await updateMyFarmerProfile({
      farmName: { en: "Thoddoo Fields", dv: "ތޮއްޑޫ ދަނޑު" },
      bio: { en: "Papaya and chillies." },
      address: "Near the harbour",
      mapLocation: { lat: 4.43, lng: 72.96 },
      pickupAvailable: true,
      logoPath,
      contact: { phone: "7771234", whatsapp: "7771234" },
    });
    const farm = await getMyFarmerProfile();
    expect(farm).toMatchObject({
      address: "Near the harbour",
      pickupAvailable: true,
      logoPath,
    });
    expect(farm?.contact.whatsapp).toBe("+9607771234");
  });

  it("rejects a map pin outside the Maldives and self-approval", async () => {
    await signInAs(farmerA.email);
    await expect(
      updateMyFarmerProfile({ mapLocation: { lat: 51.5, lng: -0.1 } }),
    ).rejects.toThrow();
    await expect(
      updateDoc(doc(getClientDb(), COLLECTIONS.farmerProfiles, farmerA.uid), {
        verified: true,
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
  });
});

describe("product management", () => {
  let productId: string;

  it("creates a published product with an uploaded photo", async () => {
    await signInAs(farmerA.email);
    productId = newProductId();
    const path = await uploadProductImage(productId, JPEG);
    await createProduct(productId, { ...input, imagePaths: [path] });
    const saved = await getFarmerProduct(farmerA.uid, productId);
    expect(saved).toMatchObject({
      farmerId: farmerA.uid,
      status: "active",
      moderation: "ok",
      farmerVisible: true,
      pickupAvailable: true,
      imagePaths: [path],
      location: LOCATION,
    });
    expect(saved?.harvestDate).toEqual(input.harvestDate);
  });

  it("edits price, quantity and status", async () => {
    await updateProduct(productId, {
      priceLaari: 3000,
      description: { dv: "ފަނި ފަޅޯ", en: "" },
    });
    await setProductQuantity(productId, 12.5);
    await setProductStatus(productId, "sold_out");
    expect(await getFarmerProduct(farmerA.uid, productId)).toMatchObject({
      priceLaari: 3000,
      quantityAvailable: 12.5,
      status: "sold_out",
      description: { dv: "ފަނި ފަޅޯ", en: "" },
    });
    await setProductStatus(productId, "paused");
    await setProductStatus(productId, "active");
  });

  it("validates input on the client before writing", async () => {
    await expect(updateProduct(productId, { priceLaari: 0 })).rejects.toThrow();
    await expect(
      updateProduct(productId, { title: { en: "", dv: "" } }),
    ).rejects.toThrow();
  });

  it("rejects bad uploads: wrong type, too large, someone else's folder", async () => {
    expect(checkImage({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(checkImage({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe(
      "size",
    );
    const storage = getClientStorage();
    await expect(
      uploadBytes(
        ref(storage, `products/${farmerA.uid}/${productId}/page.html`),
        new Uint8Array(10),
        {
          contentType: "text/html",
        },
      ),
    ).rejects.toThrow();
    await expect(
      uploadBytes(
        ref(storage, `products/${farmerA.uid}/${productId}/big.jpg`),
        new Uint8Array(5 * 1024 * 1024 + 1),
        {
          contentType: "image/jpeg",
        },
      ),
    ).rejects.toThrow();
    await expect(
      uploadBytes(
        ref(storage, `products/${farmerB.uid}/${productB}/x.jpg`),
        new Uint8Array(10),
        {
          contentType: "image/jpeg",
        },
      ),
    ).rejects.toThrow();
  });

  it("rejects image paths that point outside the farmer's own product folder", async () => {
    await expect(
      updateProduct(productId, {
        imagePaths: [`products/${farmerB.uid}/${productB}/stolen.jpg`],
      }),
    ).rejects.toThrow();
  });

  it("never lets a farmer edit or delete another farmer's product", async () => {
    await signInAs(farmerA.email);
    await expect(updateProduct(productB, { priceLaari: 1 })).rejects.toThrow();
    await expect(setProductStatus(productB, "paused")).rejects.toThrow();
    await expect(deleteProduct(productB)).rejects.toThrow();
    expect(
      (
        await getAdminDb().collection(COLLECTIONS.products).doc(productB).get()
      ).get("priceLaari"),
    ).toBe(2500);
  });

  it("re-syncs product locations after the farm moves", async () => {
    await updateMyFarmerProfile({ location: OTHER_LOCATION });
    expect(await syncProductsWithFarm()).toBeGreaterThan(0);
    expect((await getFarmerProduct(farmerA.uid, productId))?.location).toEqual(
      OTHER_LOCATION,
    );
    await updateMyFarmerProfile({ location: LOCATION });
    await syncProductsWithFarm();
  });

  it("deletes the farmer's own product and its photos", async () => {
    const id = newProductId();
    const path = await uploadProductImage(id, JPEG);
    await createProduct(id, { ...input, imagePaths: [path], status: "draft" });
    await deleteProduct(id);
    expect(await getFarmerProduct(farmerA.uid, id)).toBeNull();
    const [exists] = await (
      await import("firebase-admin/storage")
    )
      .getStorage()
      .bucket()
      .file(path)
      .exists();
    expect(exists).toBe(false);
  });
});

describe("delivery areas", () => {
  it("adds, deactivates and removes areas and keeps the farm summary in step", async () => {
    await signInAs(farmerA.email);
    const all = await createDeliveryArea({
      atollCode: "K",
      method: "ferry",
      feeLaari: 5000,
      active: true,
    });
    const island = await createDeliveryArea({
      atollCode: "AA",
      islandId: "aa-rasdhoo",
      method: "speedboat",
      notes: "Fridays",
      active: true,
    });
    let farm = await getMyFarmerProfile();
    expect(farm?.deliveryDestinations).toEqual(
      expect.arrayContaining([
        { atollCode: "K" },
        { atollCode: "AA", islandId: "aa-rasdhoo" },
      ]),
    );
    await updateDeliveryArea(all, { active: false });
    farm = await getMyFarmerProfile();
    expect(farm?.deliveryDestinations).toEqual([
      { atollCode: "AA", islandId: "aa-rasdhoo" },
    ]);
    await deleteDeliveryArea(island);
    await deleteDeliveryArea(all);
    expect((await getMyFarmerProfile())?.deliveryDestinations).toEqual([]);
  });

  it("rejects an unknown delivery method", async () => {
    await expect(
      createDeliveryArea({
        atollCode: "K",
        method: "rocket" as never,
        active: true,
      }),
    ).rejects.toThrow();
  });
});

describe("enquiries", () => {
  let enquiryId: string;

  it("shows a consumer's enquiry with shared contact details to the farmer", async () => {
    await signInAs(farmerA.email);
    const pid = newProductId();
    await createProduct(pid, input);

    await signInAs(consumer.email);
    enquiryId = randomUUID();
    await setDoc(
      doc(getClientDb(), COLLECTIONS.enquiries, enquiryId),
      buildEnquiryCreate(
        {
          productId: pid,
          quantity: 3,
          message: "Can you deliver on Friday?",
          consumerName: "Hassan",
          consumerPhone: "765 4321",
          deliverTo: OTHER_LOCATION,
        },
        { farmerId: farmerA.uid },
        consumer.uid,
        serverTimestamp(),
      ),
    );
    // The consumer can't accept on the farmer's behalf.
    await expect(setEnquiryStatus(enquiryId, "accepted")).rejects.toThrow();

    const list = await listFarmerEnquiries(farmerA.uid);
    const found = list.find((e) => e.id === enquiryId);
    expect(found).toMatchObject({
      status: "new",
      quantity: 3,
      consumerPhone: "+9607654321",
      product: { id: pid },
      deliverToPlace: { islandEn: "Rasdhoo" },
    });
    expect(await listFarmerEnquiries(farmerB.uid)).toEqual([]);
  });

  it("lets the farmer accept and complete it", async () => {
    await signInAs(farmerA.email);
    await setEnquiryStatus(enquiryId, "accepted");
    await setEnquiryStatus(enquiryId, "completed");
    expect(
      (
        await getAdminDb()
          .collection(COLLECTIONS.enquiries)
          .doc(enquiryId)
          .get()
      ).get("status"),
    ).toBe("completed");
  });
});

describe("dashboard", () => {
  it("reports real figures from the farmer's records", async () => {
    const db = getAdminDb();
    const event = (type: string) => ({
      type,
      locale: "en",
      farmerId: farmerA.uid,
      createdAt: new Date(),
    });
    await Promise.all([
      db.collection(COLLECTIONS.siteEvents).add(event("product_view")),
      db.collection(COLLECTIONS.siteEvents).add(event("product_view")),
      db.collection(COLLECTIONS.siteEvents).add(event("contact_click")),
      db
        .collection(COLLECTIONS.siteEvents)
        .add({ ...event("product_view"), farmerId: farmerB.uid }),
      db.collection(COLLECTIONS.invoices).add({
        farmerId: farmerA.uid,
        status: "issued",
        totalLaari: 10000,
        paidLaari: 2500,
      }),
      db.collection(COLLECTIONS.invoices).add({
        farmerId: farmerA.uid,
        status: "draft",
        totalLaari: 99999,
        paidLaari: 0,
      }),
      db.collection(COLLECTIONS.payments).add({
        farmerId: farmerA.uid,
        amountLaari: 2500,
        verificationStatus: "unverified",
      }),
    ]);
    const d = await getFarmerDashboard(farmerA.uid);
    expect(d.views).toBe(2);
    expect(d.contactClicks).toBe(1);
    expect(d.invoicedLaari).toBe(10000);
    expect(d.paymentsLaari).toBe(2500);
    expect(d.outstandingLaari).toBe(7500);
    expect(d.products.published).toBeGreaterThanOrEqual(2);
  });
});

describe("privilege boundaries", () => {
  it("a farmer can't make themselves admin or verify their own payment", async () => {
    await signInAs(farmerA.email);
    const db = getClientDb();
    await expect(
      updateDoc(doc(db, COLLECTIONS.users, farmerA.uid), {
        role: "admin",
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toThrow();
    const pay = await getAdminDb().collection(COLLECTIONS.payments).add({
      farmerId: farmerA.uid,
      amountLaari: 100,
      verificationStatus: "unverified",
    });
    await expect(
      updateDoc(doc(db, COLLECTIONS.payments, pay.id), {
        verificationStatus: "verified",
      }),
    ).rejects.toThrow();
    expect((await getAdminAuth().getUser(farmerA.uid)).customClaims).toEqual({
      role: "farmer",
    });
  });

  it("a suspended farmer can't keep writing, uploading or sign in again", async () => {
    await signInAs(farmerA.email); // token issued before the block
    await blockUser(admin, farmerA.uid, "Suspended for testing");
    await expect(createProduct(newProductId(), input)).rejects.toThrow();
    await expect(uploadFarmLogo(JPEG)).rejects.toThrow();
    await expect(updateMyFarmerProfile({ address: "x" })).rejects.toThrow();
    await signOut(getClientAuth());
    await expect(
      signInWithEmailAndPassword(getClientAuth(), farmerA.email, PASSWORD),
    ).rejects.toMatchObject({
      code: "auth/user-disabled",
    });
    const snap = await getDoc(
      doc(getClientDb(), COLLECTIONS.farmerProfiles, farmerA.uid),
    ).catch(() => null);
    expect(snap?.exists() ?? false).toBe(false); // hidden from the public once blocked
  });
});
