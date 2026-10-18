import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import type { ProductInput } from "@shared/schemas";
import {
  getAdminAuth,
  getAdminDb,
  getAdminStorage,
} from "@/lib/firebase/admin";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import {
  AdminOperationError,
  blockUser,
  reverseLedgerEntry,
  restoreUser,
  setFarmerApproval,
  verifyPayment,
  type Actor,
} from "@/services/server/admin";
import {
  FinanceError,
  cancelInvoice,
  createInvoice,
  createOrder,
  farmerTag,
  issueInvoice,
  recordPayment,
  recordRefund,
  reverseEntry,
  setOrderStatus,
  type FinanceActor,
} from "@/services/server/finance";
import { getInvoiceDocument } from "@/services/server/finance-queries";
import { completeRegistration } from "@/services/server/registration";
import { sendEnquiry, setEnquiryStatus } from "@/services/client/interactions";
import {
  createProduct,
  newProductId,
  updateProduct,
} from "@/services/client/products";
import { GET as invoicePdf } from "@/app/api/invoices/[id]/pdf/route";
import { GET as receiptPdf } from "@/app/api/receipts/[id]/pdf/route";
import { setTestCookie } from "../support/next-headers-stub";

/**
 * Invoices and the payment ledger against the emulators: totals and
 * rounding, snapshots, numbering, partial payments, refunds, reversals,
 * verification, permissions (services and Security Rules) and PDFs.
 */

const PASSWORD = "correct-horse-battery";
const RUN = randomUUID().slice(0, 8);
const ISLAND = `aa-fin-${RUN}`;
const LOCATION = { atollCode: "AA", islandId: ISLAND } as const;
const DAY = new Date("2026-10-15T00:00:00Z");

type Person = { uid: string; email: string };
async function member(
  role: "farmer" | "consumer",
  name: string,
): Promise<Person> {
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
          phone: "7771234",
          farmName: { en: `${name} Farm`, dv: "ދަނޑު" },
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
async function session(email: string | null) {
  if (!email) return setTestCookie("__session", null);
  await signInAs(email);
  const idToken = await getClientAuth().currentUser!.getIdToken(true);
  setTestCookie(
    "__session",
    await getAdminAuth().createSessionCookie(idToken, { expiresIn: 3600_000 }),
  );
}
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (e instanceof FinanceError || e instanceof AdminOperationError)
      return e.code;
    return `other:${String(e)}`;
  }
};
const db = () => getAdminDb();
const get = async (c: string, id: string) =>
  (await db().collection(c).doc(id).get()).data()!;

const product: ProductInput = {
  title: { en: `Papaya ${RUN}`, dv: "ފަޅޯ" },
  category: "fruits",
  unit: "kg",
  priceLaari: 2550,
  quantityAvailable: 50,
  imagePaths: [],
  deliveryDestinations: [{ atollCode: "AA" }],
  status: "active",
};

let farmer: Person;
let other: Person;
let buyer: Person;
let stranger: Person;
let owner: Actor & { email: string };
let f: FinanceActor;
let productId: string;
let enquiryId: string;
let orderId: string;
let invoiceId: string;
const payments: string[] = [];
const receipts: string[] = [];

beforeAll(async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  await db()
    .collection(COLLECTIONS.islands)
    .doc(ISLAND)
    .set({ atollCode: "AA", nameEn: `Fin Island ${RUN}`, active: true });
  farmer = await member("farmer", "Aisha");
  other = await member("farmer", "Ibrahim");
  buyer = await member("consumer", "Hassan");
  stranger = await member("consumer", "Mariyam");
  const ownerEmail = `owner-${randomUUID()}@example.test`;
  const { uid } = await getAdminAuth().createUser({
    email: ownerEmail,
    password: PASSWORD,
  });
  await getAdminAuth().setCustomUserClaims(uid, {
    role: "admin",
    adminLevel: "owner",
  });
  await db().collection(COLLECTIONS.users).doc(uid).set({
    role: "admin",
    status: "active",
    displayName: "Owner",
    preferredLocale: "en",
  });
  owner = { uid, role: "admin", adminLevel: "owner", email: ownerEmail };
  await setFarmerApproval(owner, farmer.uid, "approved");
  f = { uid: farmer.uid, role: "farmer" };

  await signInAs(farmer.email);
  productId = await createProduct(newProductId(), product);
  await signInAs(buyer.email);
  enquiryId = await sendEnquiry({
    productId,
    quantity: 2.5,
    consumerName: "Hassan Ali",
    consumerPhone: "7654321",
    deliverTo: LOCATION,
  });
});

afterAll(async () => {
  setTestCookie("__session", null);
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("agreed transactions", () => {
  it("need an accepted enquiry; totals use half-up rounding to the laari", async () => {
    const input = {
      enquiryId,
      items: [
        { productId, quantity: 2.5, unit: "kg" as const, unitPriceLaari: 2550 },
        {
          title: "Bag of chillies",
          quantity: 1.005,
          unit: "bag" as const,
          unitPriceLaari: 100,
        },
      ],
      discountLaari: 375,
      deliveryFeeLaari: 5000,
    };
    expect(await code(createOrder(f, input))).toBe("enquiry_not_accepted");
    await signInAs(farmer.email);
    await setEnquiryStatus(enquiryId, "accepted");
    expect(
      await code(createOrder(f, { ...input, discountLaari: 999999 })),
    ).toBe("discount_exceeds_subtotal");

    orderId = await createOrder(f, input);
    const order = await get(COLLECTIONS.orders, orderId);
    expect(
      order.items.map((i: { totalLaari: number }) => i.totalLaari),
    ).toEqual([6375, 101]);
    expect(order).toMatchObject({
      subtotalLaari: 6476,
      discountLaari: 375,
      deliveryFeeLaari: 5000,
      totalLaari: 11101,
      currency: "MVR",
      status: "confirmed",
      consumerId: buyer.uid,
      buyer: { name: { en: "Hassan Ali" }, phone: "+9607654321" },
    });
    expect(order.items[0].title).toEqual(product.title);
  });

  it("can't use another farmer's products, enquiries or be made by non-farmers", async () => {
    const o: FinanceActor = { uid: other.uid, role: "farmer" };
    expect(
      await code(
        createOrder(o, {
          buyerName: "X",
          items: [{ productId, quantity: 1, unit: "kg", unitPriceLaari: 100 }],
        }),
      ),
    ).toBe("invalid_input");
    expect(
      await code(
        createOrder(o, {
          enquiryId,
          items: [{ title: "x", quantity: 1, unit: "kg", unitPriceLaari: 100 }],
        }),
      ),
    ).toBe("not_found");
    expect(
      await code(
        createOrder(
          { uid: buyer.uid, role: "consumer" },
          {
            buyerName: "Me",
            items: [
              { title: "x", quantity: 1, unit: "kg", unitPriceLaari: 100 },
            ],
          },
        ),
      ),
    ).toBe("forbidden");
  });
});

describe("invoices", () => {
  it("drafts copy the snapshot; listing edits later don't change history", async () => {
    invoiceId = await createInvoice(f, {
      orderId,
      dueAt: DAY,
      paymentTerms: "Pay within 7 days.",
    });
    expect(await code(createInvoice(f, { orderId }))).toBe("already_invoiced");
    await signInAs(farmer.email);
    await updateProduct(productId, {
      priceLaari: 9999,
      title: { en: "Renamed papaya" },
    });
    const inv = await get(COLLECTIONS.invoices, invoiceId);
    expect(inv.lines[0]).toMatchObject({
      title: product.title,
      unitPriceLaari: 2550,
      totalLaari: 6375,
    });
    expect(inv).toMatchObject({
      status: "draft",
      totalLaari: 11101,
      paidLaari: 0,
    });
    expect(inv.number).toBeUndefined();
    expect(
      (await get(COLLECTIONS.orders, orderId)).items[0].unitPriceLaari,
    ).toBe(2550);
  });

  it("issuing assigns unique sequential numbers; a used number is never reused", async () => {
    const number = await issueInvoice(f, invoiceId);
    expect(number).toBe(`INV-${farmerTag(farmer.uid)}-0001`);
    expect(await code(issueInvoice(f, invoiceId))).toBe("invalid_state");

    // A second transaction's invoice gets the next number…
    const o2 = await createOrder(f, {
      buyerName: "Walk-in buyer",
      items: [
        { title: "Eggs", quantity: 30, unit: "piece", unitPriceLaari: 300 },
      ],
    });
    const i2 = await createInvoice(f, { orderId: o2 });
    // …unless that number already exists anywhere, in which case nothing is issued.
    await db()
      .collection(COLLECTIONS.documentNumbers)
      .doc(`INV-${farmerTag(farmer.uid)}-0002`)
      .set({ kind: "invoice" });
    expect(await code(issueInvoice(f, i2))).toMatch(/other:/);
    expect((await get(COLLECTIONS.invoices, i2)).status).toBe("draft");
    await db()
      .collection(COLLECTIONS.financeCounters)
      .doc(farmer.uid)
      .set({ invoice: 2 }, { merge: true });
    expect(await issueInvoice(f, i2)).toBe(`INV-${farmerTag(farmer.uid)}-0003`);
    // No payments yet: it can be cancelled (and stays on record).
    await cancelInvoice(f, i2, "Buyer changed their mind");
    expect((await get(COLLECTIONS.invoices, i2)).status).toBe("cancelled");
  });

  it("another farmer can't issue, cancel or record against this invoice", async () => {
    const o: FinanceActor = { uid: other.uid, role: "farmer" };
    expect(await code(issueInvoice(o, invoiceId))).toBe("not_found");
    expect(await code(cancelInvoice(o, invoiceId, "Not mine"))).toBe(
      "not_found",
    );
    expect(
      await code(
        recordPayment(o, invoiceId, {
          amountLaari: 100,
          method: "cash",
          receivedAt: DAY,
        }),
      ),
    ).toBe("not_found");
    expect(await code(setOrderStatus(o, orderId, "cancelled"))).toBe(
      "not_found",
    );
  });
});

describe("payment ledger", () => {
  it("records partial and multiple payments; the balance comes from the ledger", async () => {
    const p1 = await recordPayment(f, invoiceId, {
      amountLaari: 5000,
      method: "cash",
      receivedAt: DAY,
    });
    payments.push(p1.paymentId);
    receipts.push(p1.receiptId);
    expect(p1.receiptNumber).toBe(`RCT-${farmerTag(farmer.uid)}-0001`);
    expect(await get(COLLECTIONS.invoices, invoiceId)).toMatchObject({
      status: "partially_paid",
      paidLaari: 5000,
    });
    expect(
      (await get(COLLECTIONS.payments, p1.paymentId)).verificationStatus,
    ).toBe("recorded");

    // A transfer with a slip awaits verification.
    await signInAs(farmer.email);
    const slip = `payments/${farmer.uid}/up${RUN}/slip.jpg`;
    await getAdminStorage()
      .bucket()
      .file(slip)
      .save(Buffer.alloc(2048), { contentType: "image/jpeg" });
    const p2 = await recordPayment(f, invoiceId, {
      amountLaari: 3000,
      method: "bank_transfer",
      reference: "BML-778",
      receivedAt: DAY,
      proofPath: slip,
    });
    payments.push(p2.paymentId);
    receipts.push(p2.receiptId);
    expect(
      (await get(COLLECTIONS.payments, p2.paymentId)).verificationStatus,
    ).toBe("pending_verification");

    expect(
      await code(
        recordPayment(f, invoiceId, {
          amountLaari: 3102,
          method: "cash",
          receivedAt: DAY,
        }),
      ),
    ).toBe("overpayment");
    // Someone tampering with the cached balance doesn't change what's owed.
    await db()
      .collection(COLLECTIONS.invoices)
      .doc(invoiceId)
      .update({ paidLaari: 0 });
    const doc1 = await getInvoiceDocument(invoiceId, {
      uid: farmer.uid,
      role: "farmer",
    });
    expect(doc1!.summary).toMatchObject({
      netPaidLaari: 8000,
      outstandingLaari: 3101,
      pendingLaari: 3000,
    });

    const p3 = await recordPayment(f, invoiceId, {
      amountLaari: 3101,
      method: "mobile_wallet",
      receivedAt: DAY,
    });
    payments.push(p3.paymentId);
    expect(await get(COLLECTIONS.invoices, invoiceId)).toMatchObject({
      status: "paid",
      paidLaari: 11101,
    });
    expect(
      await code(
        recordPayment(f, invoiceId, {
          amountLaari: 1,
          method: "cash",
          receivedAt: DAY,
        }),
      ),
    ).toBe("invalid_state");
    // Paid invoices can't be cancelled.
    expect(await code(cancelInvoice(f, invoiceId, "Too late"))).toBe(
      "invalid_state",
    );
  });

  it("verification needs an administrator and evidence; farmers can't verify", async () => {
    // The mobile-wallet payment has no slip or reference: it's the seller's own record.
    expect(
      (await get(COLLECTIONS.payments, payments[2])).verificationStatus,
    ).toBe("recorded");
    expect(await code(verifyPayment(owner, payments[2], "verified"))).toBe(
      "invalid_state",
    );
    expect(
      await code(
        verifyPayment(
          { uid: farmer.uid, role: "farmer" },
          payments[1],
          "verified",
        ),
      ),
    ).toBe("forbidden");
    await signInAs(farmer.email);
    await expect(
      updateDoc(doc(getClientDb(), COLLECTIONS.payments, payments[1]), {
        verificationStatus: "verified",
      }),
    ).rejects.toThrow();

    await verifyPayment(
      owner,
      payments[1],
      "verified",
      "Matches BML statement",
    );
    expect(await get(COLLECTIONS.payments, payments[1])).toMatchObject({
      verificationStatus: "verified",
      verifiedBy: owner.uid,
    });
    const logs = await db()
      .collection(COLLECTIONS.adminLogs)
      .where("targetId", "==", payments[1])
      .get();
    expect(logs.docs.map((d) => d.get("action"))).toContain(
      "payment.verification",
    );
  });

  it("corrections are reversals and refunds, never deletions", async () => {
    // A farmer can't reverse a verified entry; an admin can.
    expect(await code(reverseEntry(f, payments[1], "Wrong amount"))).toBe(
      "forbidden",
    );
    // Reverse the cash payment: it stays on record, marked reversed.
    await reverseEntry(f, payments[0], "Entered twice by mistake");
    const original = await get(COLLECTIONS.payments, payments[0]);
    expect(original).toMatchObject({
      reversed: true,
      effectiveLaari: 0,
      amountLaari: 5000,
    });
    expect(await get(COLLECTIONS.invoices, invoiceId)).toMatchObject({
      status: "partially_paid",
      paidLaari: 6101,
    });
    expect(await code(reverseEntry(f, payments[0], "Again"))).toBe(
      "invalid_state",
    );

    // Refunds: no more than what's been paid.
    expect(
      await code(
        recordRefund(f, invoiceId, {
          amountLaari: 6102,
          method: "cash",
          receivedAt: DAY,
        }),
      ),
    ).toBe("refund_exceeds_paid");
    await recordRefund(f, invoiceId, {
      amountLaari: 3101,
      method: "cash",
      receivedAt: DAY,
    });
    expect(await get(COLLECTIONS.invoices, invoiceId)).toMatchObject({
      paidLaari: 3000,
      refundedLaari: 3101,
    });
    await reverseLedgerEntry(owner, payments[1], "Bank recalled the transfer");
    expect(await get(COLLECTIONS.invoices, invoiceId)).toMatchObject({
      status: "refunded",
      paidLaari: 0,
    });

    const ledger = await db()
      .collection(COLLECTIONS.payments)
      .where("invoiceId", "==", invoiceId)
      .get();
    expect(ledger.size).toBe(6); // 3 payments, 1 refund, 2 reversals — nothing deleted
    await signInAs(farmer.email);
    await expect(
      updateDoc(doc(getClientDb(), COLLECTIONS.invoices, invoiceId), {
        paidLaari: 11101,
      }),
    ).rejects.toThrow();
  });

  it("a blocked farmer can't record payments; the records remain", async () => {
    await blockUser(owner, farmer.uid, "Testing finance under a block");
    expect(
      await code(
        recordPayment(f, invoiceId, {
          amountLaari: 1,
          method: "cash",
          receivedAt: DAY,
        }),
      ),
    ).toBe("account_inactive");
    expect(
      (await db().collection(COLLECTIONS.invoices).doc(invoiceId).get()).exists,
    ).toBe(true);
    await restoreUser(owner, farmer.uid);
  });
});

describe("who can see what", () => {
  it("the buyer and admins can read the invoice; other buyers and farmers can't", async () => {
    await signInAs(buyer.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.invoices, invoiceId)),
    ).resolves.toBeTruthy();
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.payments, payments[1])),
    ).resolves.toBeTruthy();
    await expect(
      updateDoc(doc(getClientDb(), COLLECTIONS.invoices, invoiceId), {
        status: "paid",
      }),
    ).rejects.toThrow();
    await signInAs(stranger.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.invoices, invoiceId)),
    ).rejects.toThrow();
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.receipts, receipts[0])),
    ).rejects.toThrow();
    await signInAs(other.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.orders, orderId)),
    ).rejects.toThrow();

    expect(
      await getInvoiceDocument(invoiceId, {
        uid: stranger.uid,
        role: "consumer",
      }),
    ).toBeNull();
    expect(
      await getInvoiceDocument(invoiceId, { uid: other.uid, role: "farmer" }),
    ).toBeNull();
    expect(
      (
        await getInvoiceDocument(invoiceId, {
          uid: buyer.uid,
          role: "consumer",
        })
      )?.access,
    ).toBe("buyer");
    expect((await getInvoiceDocument(invoiceId, owner))?.access).toBe("admin");
    const views = await db()
      .collection(COLLECTIONS.adminLogs)
      .where("targetId", "==", invoiceId)
      .get();
    expect(
      views.docs.some(
        (d) =>
          d.get("action") === "finance.view" && d.get("actorId") === owner.uid,
      ),
    ).toBe(true);
  });

  it("buyers never see the farmer's drafts", async () => {
    const o = await createOrder(f, {
      enquiryId,
      items: [{ productId, quantity: 1, unit: "kg", unitPriceLaari: 2550 }],
    });
    const draft = await createInvoice(f, { orderId: o });
    expect(
      await getInvoiceDocument(draft, { uid: buyer.uid, role: "consumer" }),
    ).toBeNull();
  });
});

describe("PDFs", () => {
  type Route = (req: Request, ctx: never) => Promise<Response>;
  const call = (id: string, fn: Route) =>
    fn(new Request(`http://localhost/api/x/${id}/pdf`), {
      params: Promise.resolve({ id }),
    } as never);

  it("are generated for the farmer, buyer and admins only", async () => {
    await session(farmer.email);
    const res = await call(invoiceId, invoicePdf);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
    expect(res.headers.get("content-disposition")).toContain(
      `INV-${farmerTag(farmer.uid)}-0001.pdf`,
    );

    await session(buyer.email);
    expect((await call(invoiceId, invoicePdf)).status).toBe(200);
    expect((await call(receipts[0], receiptPdf as Route)).status).toBe(200);
    await session(stranger.email);
    expect((await call(invoiceId, invoicePdf)).status).toBe(404);
    expect((await call(receipts[0], receiptPdf as Route)).status).toBe(404);
    await session(other.email);
    expect((await call(invoiceId, invoicePdf)).status).toBe(404);
    await session(null);
    expect((await call(invoiceId, invoicePdf)).status).toBe(401);
    await session(owner.email);
    expect((await call(invoiceId, invoicePdf)).status).toBe(200);
  });
});
