import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import {
  getBytes,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { emulatorHost, PROJECT_ID } from "../support/fixtures";

/**
 * Storage rules against the Storage + Firestore emulators (the rules read
 * users/{uid}.status from Firestore). Needs the Storage emulator runtime:
 *   npx firebase setup:emulators:storage   (one-time download)
 *   npm run test:storage-rules
 * Skipped automatically when the Storage emulator isn't running.
 */
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const describeIfStorage = storageHost ? describe : describe.skip;

let env: RulesTestEnvironment;
const KB = 1024;
const bytes = (size: number) => new Uint8Array(size);
const jpeg = { contentType: "image/jpeg" };

const asFarmerA = () =>
  env.authenticatedContext("farmerA", { role: "farmer" }).storage();
const asFarmerB = () =>
  env.authenticatedContext("farmerB", { role: "farmer" }).storage();
const asBlocked = () =>
  env.authenticatedContext("blockedD", { role: "farmer" }).storage();
const asConsumer = () =>
  env.authenticatedContext("consumerC", { role: "consumer" }).storage();
const asAdmin = () =>
  env.authenticatedContext("adminE", { role: "admin" }).storage();
const asAnon = () => env.unauthenticatedContext().storage();

const put = (s: FirebaseStorage, path: string, size = KB, meta = jpeg) =>
  uploadBytes(ref(s, path), bytes(size), meta);

describeIfStorage("storage rules", () => {
  beforeAll(async () => {
    env = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      storage: {
        rules: readFileSync(
          join(__dirname, "../../firebase/storage.rules"),
          "utf8",
        ),
        ...emulatorHost("FIREBASE_STORAGE_EMULATOR_HOST"),
      },
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
    await env.clearStorage();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, "users/farmerA"), {
        role: "farmer",
        status: "active",
      });
      await setDoc(doc(db, "users/farmerB"), {
        role: "farmer",
        status: "active",
      });
      await setDoc(doc(db, "users/blockedD"), {
        role: "farmer",
        status: "blocked",
      });
      await setDoc(doc(db, "users/consumerC"), {
        role: "consumer",
        status: "active",
      });
      await uploadBytes(
        ref(ctx.storage(), "payments/farmerA/pay1/slip.pdf"),
        bytes(KB),
        {
          contentType: "application/pdf",
        },
      );
      await uploadBytes(
        ref(ctx.storage(), "products/farmerA/p1/existing.jpg"),
        bytes(KB),
        jpeg,
      );
    });
  });

  describe("product images", () => {
    it("can be uploaded by the owning active farmer", async () => {
      await assertSucceeds(put(asFarmerA(), "products/farmerA/p1/photo.jpg"));
      await assertSucceeds(
        put(asFarmerA(), "products/farmerA/p1/photo.webp", KB, {
          contentType: "image/webp",
        }),
      );
    });

    it("enforce ownership, role and account status", async () => {
      await assertFails(put(asFarmerB(), "products/farmerA/p1/photo.jpg"));
      await assertFails(put(asConsumer(), "products/consumerC/p1/photo.jpg"));
      await assertFails(put(asAnon(), "products/farmerA/p1/photo.jpg"));
      await assertFails(put(asBlocked(), "products/blockedD/p1/photo.jpg"));
    });

    it("enforce file type, size and name", async () => {
      await assertFails(
        put(asFarmerA(), "products/farmerA/p1/big.jpg", 5 * KB * KB + 1),
      );
      await assertFails(
        put(asFarmerA(), "products/farmerA/p1/page.html", KB, {
          contentType: "text/html",
        }),
      );
      await assertFails(
        put(asFarmerA(), "products/farmerA/p1/vector.svg", KB, {
          contentType: "image/svg+xml",
        }),
      );
      await assertFails(put(asFarmerA(), "products/farmerA/p1/bad name!.jpg"));
    });

    it("are publicly viewable", async () => {
      await assertSucceeds(
        getBytes(ref(asAnon(), "products/farmerA/p1/existing.jpg")),
      );
    });
  });

  describe("payment proofs", () => {
    it("are private to the farmer and admins", async () => {
      await assertSucceeds(
        getBytes(ref(asFarmerA(), "payments/farmerA/pay1/slip.pdf")),
      );
      await assertSucceeds(
        getBytes(ref(asAdmin(), "payments/farmerA/pay1/slip.pdf")),
      );
      await assertFails(
        getBytes(ref(asConsumer(), "payments/farmerA/pay1/slip.pdf")),
      );
      await assertFails(
        getBytes(ref(asAnon(), "payments/farmerA/pay1/slip.pdf")),
      );
    });

    it("accept PDFs and images from the owner, and can't be overwritten", async () => {
      await assertSucceeds(
        put(asFarmerA(), "payments/farmerA/pay2/slip.pdf", KB, {
          contentType: "application/pdf",
        }),
      );
      await assertFails(
        put(asFarmerA(), "payments/farmerA/pay1/slip.pdf", KB, {
          contentType: "application/pdf",
        }),
      );
      await assertFails(
        put(asFarmerB(), "payments/farmerA/pay3/slip.pdf", KB, {
          contentType: "application/pdf",
        }),
      );
    });
  });

  describe("branding", () => {
    it("is read-only for every client, including admins", async () => {
      await assertFails(
        put(asAdmin(), "branding/logo.png", KB, { contentType: "image/png" }),
      );
    });
  });
});
