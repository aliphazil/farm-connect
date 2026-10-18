import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import { buildFavourite } from "@shared/payloads";
import type { ProductInput } from "@shared/schemas";
import {
  getAdminAuth,
  getAdminDb,
  getAdminStorage,
} from "@/lib/firebase/admin";
import { getClientAuth, getClientDb } from "@/lib/firebase/client";
import {
  AdminOperationError,
  addReportNote,
  assignReport,
  blockUser,
  decideAppeal,
  decideReport,
  requestReportInfo,
  restoreUser,
  setAppealSettings,
  setFarmerApproval,
  setRestrictions,
  suspendUser,
  warnUser,
  type Actor,
} from "@/services/server/admin";
import { getReportDetail } from "@/services/server/admin-queries";
import {
  AppealError,
  listMyNotices,
  submitAppeal,
} from "@/services/server/appeals";
import { listConsumerReports } from "@/services/server/consumer";
import { completeRegistration } from "@/services/server/registration";
import {
  REPORTS_PER_DAY,
  ReportError,
  replyToReport,
  submitReport,
  type Reporter,
} from "@/services/server/reports";
import { sendEnquiry, setEnquiryStatus } from "@/services/client/interactions";
import {
  createProduct,
  deleteProduct,
  newProductId,
} from "@/services/client/products";
import { updateMyFarmerProfile } from "@/services/client/account";
import { uploadReportEvidence } from "@/services/client/uploads";
import { POST as appealsPOST } from "@/app/api/appeals/route";

/**
 * Trust & safety end to end against the emulators: reporting rules,
 * duplicate/abuse protection, evidence, the admin workflow, enforcement,
 * appeals, and what blocked users can and can't do.
 */

const PASSWORD = "correct-horse-battery";
const RUN = randomUUID().slice(0, 8);
const ISLAND = `aa-ts-${RUN}`;
const LOCATION = { atollCode: "AA", islandId: ISLAND } as const;
const JPEG = () => new Blob([new Uint8Array(2048)], { type: "image/jpeg" });

const input: ProductInput = {
  title: { en: `Mango ${RUN}` },
  category: "fruits",
  unit: "kg",
  priceLaari: 3000,
  quantityAvailable: 10,
  imagePaths: [],
  deliveryDestinations: [{ atollCode: "AA" }],
  status: "active",
};

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
          farmName: { en: `${name} Farm ${RUN}` },
          location: LOCATION,
        }
      : { role, displayName: name, preferredLocale: "en", acceptTerms: true },
  );
  return { uid, email };
}

async function adminAccount(level: "owner" | "moderator"): Promise<Actor> {
  const { uid } = await getAdminAuth().createUser({
    email: `${level}-${randomUUID()}@example.test`,
    password: PASSWORD,
  });
  await getAdminAuth().setCustomUserClaims(uid, {
    role: "admin",
    adminLevel: level,
  });
  await getAdminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({
      role: "admin",
      status: "active",
      displayName: `${level} admin`,
      preferredLocale: "en",
    });
  return { uid, role: "admin", adminLevel: level };
}

async function signInAs(email: string) {
  await signOut(getClientAuth()).catch(() => undefined);
  await signInWithEmailAndPassword(getClientAuth(), email, PASSWORD);
  await getClientAuth().currentUser!.getIdToken(true);
}

const as = (p: Person, role: string): Reporter => ({ uid: p.uid, role });
const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    if (
      e instanceof ReportError ||
      e instanceof AdminOperationError ||
      e instanceof AppealError
    )
      return e.code;
    return `other:${String(e)}`;
  }
};
const db = () => getAdminDb();
const reportDoc = async (id: string) =>
  (await db().collection(COLLECTIONS.reports).doc(id).get()).data()!;
const why = (details: string) => ({ reason: "fraud_scam" as const, details });

let owner: Actor;
let moderator: Actor;
let farmer: Person; // reported farmer
let farmer2: Person; // a farmer with no dealings with the buyer
let buyer: Person;
let stranger: Person;
let productId: string;
let product2: string;
let enquiryId: string;
let farmReportId: string;

beforeAll(async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  await db()
    .collection(COLLECTIONS.islands)
    .doc(ISLAND)
    .set({ atollCode: "AA", nameEn: `TS Island ${RUN}`, active: true });
  owner = await adminAccount("owner");
  moderator = await adminAccount("moderator");
  farmer = await member("farmer", "Hawwa");
  farmer2 = await member("farmer", "Moosa");
  buyer = await member("consumer", "Shifa");
  stranger = await member("consumer", "Nashid");
  await setFarmerApproval(owner, farmer.uid, "approved");
  await setFarmerApproval(owner, farmer2.uid, "approved");
  await signInAs(farmer.email);
  productId = await createProduct(newProductId(), input);
  await signInAs(farmer2.email);
  product2 = await createProduct(newProductId(), {
    ...input,
    title: { en: `Lime ${RUN}` },
  });
  await signInAs(buyer.email);
  enquiryId = await sendEnquiry({
    productId,
    quantity: 2,
    deliverTo: LOCATION,
  });
});

afterAll(async () => {
  await signOut(getClientAuth()).catch(() => undefined);
  await setAppealSettings(owner, {
    appealsEnabled: true,
    allowAppealHold: false,
  });
});

describe("who can report whom", () => {
  it("a buyer reports a farm, with evidence", async () => {
    await signInAs(buyer.email);
    const evidence = await uploadReportEvidence(JPEG());
    farmReportId = await submitReport(as(buyer, "consumer"), {
      targetType: "farmer",
      targetId: farmer.uid,
      ...why("Took payment by transfer and stopped answering."),
      evidencePaths: [evidence],
    });
    expect(await reportDoc(farmReportId)).toMatchObject({
      reporterId: buyer.uid,
      reporterRole: "consumer",
      reportedUserId: farmer.uid,
      status: "open",
      assigneeId: null,
      evidencePaths: [evidence],
    });
  });

  it("a buyer reports a listing (the farmer is the reported account)", async () => {
    const id = await submitReport(as(buyer, "consumer"), {
      targetType: "product",
      targetId: productId,
      reason: "misleading_information",
      details: "The photo isn't the product that was sold.",
    });
    expect(await reportDoc(id)).toMatchObject({
      reportedUserId: farmer.uid,
      productId,
    });
  });

  it("a farmer reports a buyer through a suspicious enquiry, or directly after dealing with them", async () => {
    const viaEnquiry = await submitReport(as(farmer, "farmer"), {
      targetType: "enquiry",
      targetId: enquiryId,
      reason: "harassment",
      details: "Abusive messages after I declined the order.",
    });
    expect(await reportDoc(viaEnquiry)).toMatchObject({
      reportedUserId: buyer.uid,
      enquiryId,
      productId,
      reporterRole: "farmer",
    });
    const direct = await submitReport(as(farmer, "farmer"), {
      targetType: "user",
      targetId: buyer.uid,
      reason: "spam",
      details: "Sends the same enquiry again and again.",
    });
    expect((await reportDoc(direct)).reportedUserId).toBe(buyer.uid);
  });

  it("refuses reports about people the reporter hasn't dealt with, themselves, admins or nothing", async () => {
    // farmer2 never dealt with the buyer.
    expect(
      await code(
        submitReport(as(farmer2, "farmer"), {
          targetType: "user",
          targetId: buyer.uid,
          ...why("I don't know them."),
        }),
      ),
    ).toBe("not_allowed");
    expect(
      await code(
        submitReport(as(farmer2, "farmer"), {
          targetType: "enquiry",
          targetId: enquiryId,
          ...why("Not my enquiry."),
        }),
      ),
    ).toBe("not_found");
    expect(
      await code(
        submitReport(as(farmer, "farmer"), {
          targetType: "product",
          targetId: productId,
          ...why("My own listing."),
        }),
      ),
    ).toBe("not_allowed");
    expect(
      await code(
        submitReport(as(buyer, "consumer"), {
          targetType: "user",
          targetId: owner.uid,
          ...why("Reporting an admin."),
        }),
      ),
    ).toBe("not_found");
    expect(
      await code(
        submitReport(as(buyer, "consumer"), {
          targetType: "product",
          targetId: "nope",
          ...why("Doesn't exist."),
        }),
      ),
    ).toBe("not_found");
    expect(
      await code(
        submitReport(
          { uid: owner.uid, role: "admin" },
          {
            targetType: "farmer",
            targetId: farmer.uid,
            ...why("Admins use records."),
          },
        ),
      ),
    ).toBe("not_allowed");
  });
});

describe("duplicates, rate limits and abusive attempts", () => {
  it("blocks a second open report about the same thing", async () => {
    expect(
      await code(
        submitReport(as(buyer, "consumer"), {
          targetType: "farmer",
          targetId: farmer.uid,
          ...why("Again, same farm."),
        }),
      ),
    ).toBe("duplicate");
  });

  it(`limits each reporter to ${REPORTS_PER_DAY} reports a day`, async () => {
    // The buyer has 2 so far; three more distinct subjects reach the limit.
    for (const [targetType, targetId] of [
      ["enquiry", enquiryId],
      ["farmer", farmer2.uid],
      ["product", product2],
    ] as const)
      expect(
        await code(
          submitReport(as(buyer, "consumer"), {
            targetType,
            targetId,
            ...why("Distinct subject here."),
          }),
        ),
      ).toBe("ok");
    expect(
      await code(
        submitReport(as(buyer, "consumer"), {
          targetType: "user",
          targetId: farmer.uid,
          ...why("One too many."),
        }),
      ),
    ).toBe("rate_limited");
  });

  it("rejects evidence that isn't the reporter's own, missing, or the wrong type", async () => {
    await signInAs(farmer.email);
    const farmersFile = await uploadReportEvidence(JPEG());
    const subject = {
      targetType: "product" as const,
      targetId: product2,
      ...why("Evidence checks here."),
    };
    expect(
      await code(
        submitReport(as(stranger, "consumer"), {
          ...subject,
          evidencePaths: [farmersFile],
        }),
      ),
    ).toBe("evidence_invalid");
    expect(
      await code(
        submitReport(as(stranger, "consumer"), {
          ...subject,
          evidencePaths: [`reportEvidence/${stranger.uid}/missing.jpg`],
        }),
      ),
    ).toBe("evidence_invalid");
    // A file that slipped in with a dangerous type (only possible with admin access).
    const html = `reportEvidence/${stranger.uid}/page.jpg`;
    await getAdminStorage()
      .bucket()
      .file(html)
      .save("<script>alert(1)</script>", { contentType: "text/html" });
    expect(
      await code(
        submitReport(as(stranger, "consumer"), {
          ...subject,
          evidencePaths: [html],
        }),
      ),
    ).toBe("evidence_invalid");
    expect(
      await code(
        submitReport(as(stranger, "consumer"), {
          ...subject,
          evidencePaths: ["../../products/x.jpg"],
        }),
      ),
    ).toBe("evidence_invalid");
  });

  it("restricted and suspended accounts can't report", async () => {
    await setRestrictions(moderator, stranger.uid, ["reports"], "Report spam");
    expect(
      await code(
        submitReport(as(stranger, "consumer"), {
          targetType: "product",
          targetId: product2,
          ...why("Trying anyway."),
        }),
      ),
    ).toBe("restricted");
    await setRestrictions(moderator, stranger.uid, [], "Lifted");
    await suspendUser(moderator, stranger.uid, 1, "Cooling off");
    expect(
      await code(
        submitReport(as(stranger, "consumer"), {
          targetType: "product",
          targetId: product2,
          ...why("Trying anyway."),
        }),
      ),
    ).toBe("not_allowed");
    await restoreUser(moderator, stranger.uid);
  });
});

describe("report privacy", () => {
  it("only the reporter and admins can read a report; the reported party can't", async () => {
    await signInAs(buyer.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.reports, farmReportId)),
    ).resolves.toBeTruthy();
    await signInAs(farmer.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.reports, farmReportId)),
    ).rejects.toThrow();
    await expect(
      getDocs(
        query(
          collection(getClientDb(), COLLECTIONS.reports),
          where("reportedUserId", "==", farmer.uid),
        ),
      ),
    ).rejects.toThrow();
    await signInAs(stranger.email);
    await expect(
      getDoc(doc(getClientDb(), COLLECTIONS.reports, farmReportId)),
    ).rejects.toThrow();
    // Farmers' own report lists don't include reports about them.
    expect(
      (await listConsumerReports(farmer.uid)).map((r) => r.reportedUserId),
    ).not.toContain(farmer.uid);
  });
});

describe("admin workflow", () => {
  it("assign, add private notes, ask the reporter, receive the reply", async () => {
    await assignReport(moderator, farmReportId, moderator.uid);
    expect(await code(assignReport(moderator, farmReportId, buyer.uid))).toBe(
      "invalid_input",
    );
    await addReportNote(
      moderator,
      farmReportId,
      "Second report about this farm this month.",
    );
    await requestReportInfo(
      moderator,
      farmReportId,
      "Do you have the transfer receipt number?",
    );
    expect((await reportDoc(farmReportId)).status).toBe("awaiting_info");

    // The reporter sees the question but never the internal note.
    await signInAs(buyer.email);
    const msgs = await getDocs(
      collection(getClientDb(), COLLECTIONS.reports, farmReportId, "messages"),
    );
    expect(msgs.docs.map((d) => d.get("body"))).toEqual([
      "Do you have the transfer receipt number?",
    ]);
    await expect(
      getDocs(
        collection(getClientDb(), COLLECTIONS.reports, farmReportId, "notes"),
      ),
    ).rejects.toThrow();
    const mine = (await listConsumerReports(buyer.uid)).find(
      (r) => r.id === farmReportId,
    )!;
    expect(mine.assigneeId).toBeUndefined();
    expect(mine.evidencePaths).toBeUndefined();

    expect(
      await code(
        replyToReport(as(stranger, "consumer"), farmReportId, "Not mine"),
      ),
    ).toBe("not_found");
    await replyToReport(
      as(buyer, "consumer"),
      farmReportId,
      "Receipt BML-123456.",
    );
    expect((await reportDoc(farmReportId)).status).toBe("reviewing");
    expect(
      await code(replyToReport(as(buyer, "consumer"), farmReportId, "Again")),
    ).toBe("invalid_state");

    const detail = (await getReportDetail(farmReportId))!;
    expect(detail.notes.map((n) => n.body)).toEqual([
      "Second report about this farm this month.",
    ]);
    expect(detail.messages.map((m) => m.author)).toEqual(["admin", "reporter"]);
    expect(detail.assigneeName).toBe("moderator admin");
  });

  it("a moderator can't block from a report; the decision suspends the farmer and closes the report", async () => {
    expect(
      await code(
        decideReport(moderator, farmReportId, {
          close: "resolved",
          resolution: "Confirmed",
          outcome: "block",
          userReason: "Fraud confirmed",
        }),
      ),
    ).toBe("forbidden");
    const actionId = await decideReport(moderator, farmReportId, {
      close: "resolved",
      resolution:
        "We've taken action on this account. Thank you for reporting.",
      outcome: "suspension",
      userReason: "Payments taken without delivering, reported by buyers.",
      days: 7,
      internalNote: "Receipt checked with the bank reference.",
    });
    expect(actionId).toBeTruthy();
    expect(await reportDoc(farmReportId)).toMatchObject({
      status: "resolved",
      outcome: "suspension",
      enforcementActionId: actionId,
      handledBy: moderator.uid,
    });
    const action = (
      await db().collection(COLLECTIONS.enforcementActions).doc(actionId!).get()
    ).data()!;
    expect(action).toMatchObject({
      userId: farmer.uid,
      type: "suspension",
      reportId: farmReportId,
      createdBy: moderator.uid,
      status: "active",
      appeal: { status: "none" },
    });
    expect(action.expiresAt).toBeTruthy();
    expect(
      (await db().collection(COLLECTIONS.users).doc(farmer.uid).get()).get(
        "status",
      ),
    ).toBe("suspended");
    // Guard released: the buyer may report this farm again later.
    expect(
      (
        await db()
          .collection(COLLECTIONS.reportGuards)
          .doc(`${buyer.uid}_farmer_${farmer.uid}`)
          .get()
      ).get("open"),
    ).toBe(false);
  });
});

describe("notices and appeals", () => {
  it("the user sees the reason (not internal notes or admin ids) and can appeal once", async () => {
    const { notices } = await listMyNotices(farmer.uid);
    const n = notices.find((x) => x.type === "suspension")!;
    expect(n.reason).toBe(
      "Payments taken without delivering, reported by buyers.",
    );
    expect(n).not.toHaveProperty("internalNote");
    expect(n).not.toHaveProperty("createdBy");
    expect(n).not.toHaveProperty("reportId");
    expect(n.canAppeal).toBe(true);

    expect(
      await code(
        submitAppeal(stranger.uid, { actionId: n.id, message: "x".repeat(30) }),
      ),
    ).toBe("not_found");
    expect(
      await code(
        submitAppeal(farmer.uid, { actionId: n.id, message: "too short" }),
      ),
    ).toBe("invalid_input");
    await submitAppeal(farmer.uid, {
      actionId: n.id,
      message:
        "The buyer cancelled; I refunded them the same day. Bank reference attached.",
    });
    expect(
      await code(
        submitAppeal(farmer.uid, { actionId: n.id, message: "x".repeat(30) }),
      ),
    ).toBe("already_appealed");

    await decideAppeal(
      moderator,
      n.id,
      "overturned",
      "Refund confirmed with the bank. Sorry for the trouble.",
    );
    expect(
      (await db().collection(COLLECTIONS.users).doc(farmer.uid).get()).get(
        "status",
      ),
    ).toBe("active");
    const after = (await listMyNotices(farmer.uid)).notices.find(
      (x) => x.id === n.id,
    )!;
    expect(after).toMatchObject({
      status: "overturned",
      appeal: { status: "overturned" },
    });
    expect(after.appeal.outcomeNote).toContain("Refund confirmed");
    expect(after.appeal).not.toHaveProperty("decidedBy");
  });

  it("overturning a restriction removes it; upholding a warning keeps it", async () => {
    const restrictionId = await setRestrictions(
      moderator,
      stranger.uid,
      ["enquiries"],
      "Spam enquiries",
    );
    await submitAppeal(stranger.uid, {
      actionId: restrictionId!,
      message: "Those were genuine orders for my shop.",
    });
    await decideAppeal(
      moderator,
      restrictionId!,
      "overturned",
      "Checked: genuine orders.",
    );
    expect(
      (await db().collection(COLLECTIONS.users).doc(stranger.uid).get()).get(
        "restrictions",
      ),
    ).toBeUndefined();

    const warningId = await warnUser(
      moderator,
      stranger.uid,
      "Please keep messages polite.",
    );
    await submitAppeal(stranger.uid, {
      actionId: warningId,
      message: "I was polite in every message I sent.",
    });
    await decideAppeal(
      moderator,
      warningId,
      "upheld",
      "Messages reviewed; the warning stays.",
    );
    const w = (await listMyNotices(stranger.uid)).notices.find(
      (x) => x.id === warningId,
    )!;
    expect(w).toMatchObject({ status: "active", appeal: { status: "upheld" } });
  });

  it("appeals can be paused during an investigation only if policy allows, and closed by policy", async () => {
    expect(
      await code(
        warnUser(moderator, stranger.uid, "Under review", {
          holdAppeal: "Investigation open",
        }),
      ),
    ).toBe("hold_not_allowed");
    await setAppealSettings(owner, { allowAppealHold: true });
    const held = await warnUser(moderator, stranger.uid, "Under review", {
      holdAppeal: "Police report pending",
    });
    expect(
      await code(
        submitAppeal(stranger.uid, { actionId: held, message: "x".repeat(25) }),
      ),
    ).toBe("appeal_held");
    expect(
      (await listMyNotices(stranger.uid)).notices.find((n) => n.id === held)
        ?.canAppeal,
    ).toBe(false);

    await setAppealSettings(owner, { appealsEnabled: false });
    const other = await warnUser(moderator, stranger.uid, "Second warning");
    expect(
      await code(
        submitAppeal(stranger.uid, {
          actionId: other,
          message: "x".repeat(25),
        }),
      ),
    ).toBe("appeals_disabled");
    await setAppealSettings(owner, {
      appealsEnabled: true,
      allowAppealHold: false,
    });
  });
});

describe("blocked accounts", () => {
  let invoiceId: string;
  let paymentId: string;

  it("a blocked farmer can't list, respond to enquiries, edit or delete, and their listings disappear", async () => {
    // History that must survive the block.
    const now = new Date();
    invoiceId = (
      await db()
        .collection(COLLECTIONS.invoices)
        .add({
          number: `INV-${RUN}`,
          farmerId: farmer.uid,
          consumerId: buyer.uid,
          buyerName: "Shifa",
          lines: [
            {
              title: "Mango",
              quantity: 2,
              unit: "kg",
              unitPriceLaari: 3000,
              totalLaari: 6000,
            },
          ],
          subtotalLaari: 6000,
          deliveryFeeLaari: 0,
          totalLaari: 6000,
          paidLaari: 6000,
          status: "paid",
          issuedAt: now,
          createdAt: now,
          updatedAt: now,
        })
    ).id;
    paymentId = (
      await db().collection(COLLECTIONS.payments).add({
        invoiceId,
        farmerId: farmer.uid,
        consumerId: buyer.uid,
        amountLaari: 6000,
        method: "bank_transfer",
        receivedAt: now,
        recordedBy: farmer.uid,
        verificationStatus: "unverified",
        createdAt: now,
        updatedAt: now,
      })
    ).id;

    await signInAs(farmer.email); // signed in before the block, with an older token
    await blockUser(owner, farmer.uid, "Repeated fraud confirmed");
    expect(
      (await db().collection(COLLECTIONS.products).doc(productId).get()).get(
        "isPublic",
      ),
    ).toBe(false);

    await expect(createProduct(newProductId(), input)).rejects.toThrow();
    await expect(setEnquiryStatus(enquiryId, "accepted")).rejects.toThrow();
    await expect(deleteProduct(productId)).rejects.toThrow();
    await expect(
      updateMyFarmerProfile({ bio: { en: "Back in business" } }),
    ).rejects.toThrow();
    await expect(
      updateDoc(doc(getClientDb(), COLLECTIONS.invoices, invoiceId), {
        status: "void",
      }),
    ).rejects.toThrow();

    // Buyers can't enquire about the hidden listing.
    await signInAs(buyer.email);
    await expect(
      sendEnquiry({ productId, quantity: 1, deliverTo: LOCATION }),
    ).rejects.toThrow();
  });

  it("a blocked buyer can't enquire, save or report", async () => {
    const target = await member("consumer", "Ali");
    await blockUser(owner, target.uid, "Abusive messages to farmers");
    await signInAs(target.email);
    await expect(
      sendEnquiry({ productId: product2, quantity: 1, deliverTo: LOCATION }),
    ).rejects.toThrow();
    const fav = buildFavourite(
      target.uid,
      "product",
      product2,
      serverTimestamp(),
    );
    await expect(
      setDoc(doc(getClientDb(), COLLECTIONS.favourites, fav.id), fav.data),
    ).rejects.toThrow();
    expect(
      await code(
        submitReport(as(target, "consumer"), {
          targetType: "product",
          targetId: product2,
          ...why("Blocked user report."),
        }),
      ),
    ).toBe("not_allowed");
  });

  it("a blocked person can still read why and appeal, through the appeals endpoint", async () => {
    await signInAs(farmer.email); // Firebase sign-in still works after a block
    const token = await getClientAuth().currentUser!.getIdToken(true);
    const call = (body: object) =>
      appealsPOST(
        new Request("http://localhost:3000/api/appeals", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:3000",
            host: "localhost:3000",
          },
          body: JSON.stringify({ idToken: token, ...body }),
        }),
      );
    const list = await (await call({ action: "list" })).json();
    const block = list.notices.find(
      (n: { type: string }) => n.type === "block",
    );
    expect(block).toMatchObject({
      reason: "Repeated fraud confirmed",
      canAppeal: true,
    });
    expect(block.internalNote).toBeUndefined();
    const res = await call({
      action: "submit",
      actionId: block.id,
      message:
        "I have never taken money without delivering; please review my records.",
    });
    expect(res.status).toBe(200);
    const bad = await call({
      action: "submit",
      actionId: block.id,
      message: "x".repeat(30),
    });
    expect(await bad.json()).toEqual({ error: "already_appealed" });
    // Garbage tokens get nothing.
    const forged = await appealsPOST(
      new Request("http://localhost:3000/api/appeals", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify({ action: "list", idToken: "x".repeat(40) }),
      }),
    );
    expect(forged.status).toBe(401);
  });

  it("history is preserved: invoices, payments, enquiries, reports and audit records remain", async () => {
    const get = async (c: string, id: string) =>
      (await db().collection(c).doc(id).get()).exists;
    expect(await get(COLLECTIONS.invoices, invoiceId)).toBe(true);
    expect(await get(COLLECTIONS.payments, paymentId)).toBe(true);
    expect(await get(COLLECTIONS.enquiries, enquiryId)).toBe(true);
    expect(await get(COLLECTIONS.products, productId)).toBe(true);
    expect(await get(COLLECTIONS.reports, farmReportId)).toBe(true);
    const invoice = (
      await db().collection(COLLECTIONS.invoices).doc(invoiceId).get()
    ).data()!;
    expect(invoice).toMatchObject({ status: "paid", totalLaari: 6000 });
    const logs = await db()
      .collection(COLLECTIONS.adminLogs)
      .where("targetId", "==", farmer.uid)
      .get();
    expect(logs.docs.map((d) => d.get("action"))).toEqual(
      expect.arrayContaining([
        "user.suspend",
        "appeal.decide",
        "user.block",
        "appeal.submit",
      ]),
    );
    const actions = await db()
      .collection(COLLECTIONS.enforcementActions)
      .where("userId", "==", farmer.uid)
      .get();
    expect(actions.docs.map((d) => d.get("type")).sort()).toEqual([
      "block",
      "suspension",
    ]);
  });

  it("restoring the account brings the listings back and closes the block record", async () => {
    await restoreUser(owner, farmer.uid, "Appeal accepted after review");
    expect(
      (await db().collection(COLLECTIONS.products).doc(productId).get()).get(
        "isPublic",
      ),
    ).toBe(true);
    const block = (
      await db()
        .collection(COLLECTIONS.enforcementActions)
        .where("userId", "==", farmer.uid)
        .where("type", "==", "block")
        .get()
    ).docs[0].data();
    expect(block).toMatchObject({ status: "lifted", endedBy: owner.uid });
  });
});
