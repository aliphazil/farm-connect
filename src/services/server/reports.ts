import "server-only";

import type { DocumentSnapshot, Transaction } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  UPLOAD_LIMITS,
  storagePaths,
} from "@shared/firestore-paths";
import {
  MAX_REPORT_EVIDENCE,
  fraudReportInputSchema,
  type FraudReportInput,
  type ReportTargetType,
} from "@shared/schemas";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { addAdminLog, col, serverNow } from "./db";

/**
 * Reports from farmers and buyers. Everything a reporter submits is checked
 * here, server side (clients can't write reports directly):
 *
 * - who may report what: buyers report farms and listings; farmers report
 *   buyers and enquiries they received; anyone reports an account they've
 *   dealt with (shared enquiry). Nobody reports themselves or an admin.
 * - duplicates: one open report per reporter and subject
 *   (`reportGuards/{reporter}_{type}_{target}`, created in the same
 *   transaction as the report, released when the report is closed).
 * - rate limit: REPORTS_PER_DAY per reporter (`reportQuotas/{uid}`).
 * - evidence: only the reporter's own uploads, allowed types and sizes,
 *   at most MAX_REPORT_EVIDENCE files, and they must exist.
 * - suspended, blocked and report-restricted accounts can't report.
 */

export const REPORTS_PER_DAY = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_REPORTER_REPLIES = 10;

export type ReportErrorCode =
  | "invalid_input"
  | "not_allowed"
  | "not_found"
  | "duplicate"
  | "rate_limited"
  | "restricted"
  | "evidence_invalid"
  | "invalid_state";

export class ReportError extends Error {
  constructor(public readonly code: ReportErrorCode) {
    super(code);
    this.name = "ReportError";
  }
}

export type Reporter = { uid: string; role: string | null };

export const guardId = (uid: string, type: string, targetId: string) =>
  `${uid}_${type}_${targetId}`;

async function sharesEnquiry(a: string, b: string): Promise<boolean> {
  const enquiries = col(COLLECTIONS.enquiries);
  const [x, y] = await Promise.all([
    enquiries
      .where("consumerId", "==", a)
      .where("farmerId", "==", b)
      .limit(1)
      .get(),
    enquiries
      .where("consumerId", "==", b)
      .where("farmerId", "==", a)
      .limit(1)
      .get(),
  ]);
  return !x.empty || !y.empty;
}

type Subject = {
  reportedUserId: string;
  productId?: string;
  enquiryId?: string;
};

/** Works out who the report is about, and whether this reporter may report it. */
async function resolveSubject(
  uid: string,
  type: ReportTargetType,
  targetId: string,
): Promise<Subject> {
  const get = (c: string) =>
    col(c as never)
      .doc(targetId)
      .get();
  let subject: Subject;

  if (type === "product") {
    const p = await get(COLLECTIONS.products);
    if (!p.exists) throw new ReportError("not_found");
    const farmerId = p.get("farmerId") as string;
    const visible =
      p.get("isPublic") === true ||
      !(
        await col(COLLECTIONS.enquiries)
          .where("consumerId", "==", uid)
          .where("productId", "==", targetId)
          .limit(1)
          .get()
      ).empty;
    if (!visible) throw new ReportError("not_found");
    subject = { reportedUserId: farmerId, productId: targetId };
  } else if (type === "farmer") {
    const farm = await get(COLLECTIONS.farmerProfiles);
    if (!farm.exists) throw new ReportError("not_found");
    const isPublic =
      farm.get("approvalStatus") === "approved" && farm.get("visible") === true;
    if (!isPublic && !(await sharesEnquiry(uid, targetId)))
      throw new ReportError("not_found");
    subject = { reportedUserId: targetId };
  } else if (type === "user") {
    // Buyer accounts aren't public: only someone they've dealt with can report them.
    const user = await get(COLLECTIONS.users);
    if (!user.exists || user.get("role") === "admin")
      throw new ReportError("not_found");
    if (!(await sharesEnquiry(uid, targetId)))
      throw new ReportError("not_allowed");
    subject = { reportedUserId: targetId };
  } else {
    const e = await get(COLLECTIONS.enquiries);
    if (!e.exists) throw new ReportError("not_found");
    const farmerId = e.get("farmerId") as string;
    const consumerId = e.get("consumerId") as string;
    if (uid !== farmerId && uid !== consumerId)
      throw new ReportError("not_found");
    subject = {
      reportedUserId: uid === farmerId ? consumerId : farmerId,
      enquiryId: targetId,
      productId: e.get("productId"),
    };
  }

  if (subject.reportedUserId === uid) throw new ReportError("not_allowed");
  return subject;
}

/** Each path must be this reporter's own, existing, allowed-type upload. */
async function checkEvidence(
  uid: string,
  paths: string[] = [],
): Promise<string[]> {
  const unique = [...new Set(paths)];
  if (unique.length > MAX_REPORT_EVIDENCE)
    throw new ReportError("evidence_invalid");
  const prefix = storagePaths.reportEvidence(uid, "");
  const bucket = getAdminStorage().bucket();
  for (const path of unique) {
    const name = path.slice(prefix.length);
    if (!path.startsWith(prefix) || !/^[A-Za-z0-9._-]{1,100}$/.test(name))
      throw new ReportError("evidence_invalid");
    const [exists] = await bucket.file(path).exists();
    if (!exists) throw new ReportError("evidence_invalid");
    const [meta] = await bucket.file(path).getMetadata();
    const size = Number(meta.size ?? 0);
    if (
      !(UPLOAD_LIMITS.evidenceTypes as readonly string[]).includes(
        String(meta.contentType),
      ) ||
      size <= 0 ||
      size > UPLOAD_LIMITS.evidenceBytes
    )
      throw new ReportError("evidence_invalid");
  }
  return unique;
}

async function assertCanReport(reporter: Reporter) {
  if (reporter.role !== "farmer" && reporter.role !== "consumer")
    throw new ReportError("not_allowed");
  const user = await col(COLLECTIONS.users).doc(reporter.uid).get();
  if (!user.exists || user.get("status") !== "active")
    throw new ReportError("not_allowed");
  if (
    ((user.get("restrictions") as string[] | undefined) ?? []).includes(
      "reports",
    )
  )
    throw new ReportError("restricted");
}

function quotaAllows(snap: DocumentSnapshot, now: number) {
  const start = snap.get("windowStart")?.toDate?.()?.getTime() as
    number | undefined;
  const count = (snap.get("count") as number | undefined) ?? 0;
  if (start === undefined || now - start >= DAY_MS)
    return { ok: true, next: { windowStart: new Date(now), count: 1 } };
  if (count >= REPORTS_PER_DAY) return { ok: false, next: null };
  return { ok: true, next: { windowStart: new Date(start), count: count + 1 } };
}

/** Files a report. Returns its id. */
export async function submitReport(
  reporter: Reporter,
  input: FraudReportInput,
): Promise<string> {
  const parsed = fraudReportInputSchema.safeParse(input);
  if (!parsed.success) throw new ReportError("invalid_input");
  const data = parsed.data;
  await assertCanReport(reporter);
  const subject = await resolveSubject(
    reporter.uid,
    data.targetType,
    data.targetId,
  );
  const evidence = await checkEvidence(reporter.uid, data.evidencePaths);

  const db = getAdminDb();
  const reportRef = col(COLLECTIONS.reports).doc();
  const guardRef = col(COLLECTIONS.reportGuards).doc(
    guardId(reporter.uid, data.targetType, data.targetId),
  );
  const quotaRef = col(COLLECTIONS.reportQuotas).doc(reporter.uid);

  await db.runTransaction(async (tx: Transaction) => {
    const [guard, quota] = await Promise.all([
      tx.get(guardRef),
      tx.get(quotaRef),
    ]);
    if (guard.exists && guard.get("open") === true)
      throw new ReportError("duplicate");
    const q = quotaAllows(quota, Date.now());
    if (!q.ok) throw new ReportError("rate_limited");

    tx.create(reportRef, {
      reporterId: reporter.uid,
      reporterRole: reporter.role,
      targetType: data.targetType,
      targetId: data.targetId,
      ...subject,
      reason: data.reason,
      details: data.details,
      ...(evidence.length ? { evidencePaths: evidence } : {}),
      status: "open",
      assigneeId: null,
      createdAt: serverNow(),
      updatedAt: serverNow(),
    });
    tx.set(guardRef, {
      open: true,
      reportId: reportRef.id,
      updatedAt: serverNow(),
    });
    tx.set(quotaRef, { ...q.next, updatedAt: serverNow() });
    addAdminLog(tx, {
      actorId: reporter.uid,
      action: "report.create",
      targetType: "report",
      targetId: reportRef.id,
      details: {
        subjectType: data.targetType,
        reportedUserId: subject.reportedUserId,
        reason: data.reason,
        evidence: evidence.length,
      },
    });
  });
  return reportRef.id;
}

/** The reporter answers an admin's request for information. */
export async function replyToReport(
  reporter: Reporter,
  reportId: string,
  body: string,
): Promise<void> {
  const text = body.trim();
  if (text.length < 1 || text.length > 2000)
    throw new ReportError("invalid_input");
  const ref = col(COLLECTIONS.reports).doc(reportId);
  await getAdminDb().runTransaction(async (tx) => {
    const report = await tx.get(ref);
    if (!report.exists || report.get("reporterId") !== reporter.uid)
      throw new ReportError("not_found");
    if (report.get("status") !== "awaiting_info")
      throw new ReportError("invalid_state");
    const replies = (report.get("reporterReplies") as number | undefined) ?? 0;
    if (replies >= MAX_REPORTER_REPLIES) throw new ReportError("rate_limited");
    tx.create(ref.collection("messages").doc(), {
      author: "reporter",
      authorId: reporter.uid,
      body: text,
      createdAt: serverNow(),
    });
    tx.update(ref, {
      status: "reviewing",
      reporterReplies: replies + 1,
      updatedAt: serverNow(),
    });
    addAdminLog(tx, {
      actorId: reporter.uid,
      action: "report.reply",
      targetType: "report",
      targetId: reportId,
    });
  });
}

/** Releases the duplicate guard so the reporter may report the subject again. */
export function releaseGuard(
  tx: {
    set(
      ref: FirebaseFirestore.DocumentReference,
      data: FirebaseFirestore.DocumentData,
      options: FirebaseFirestore.SetOptions,
    ): unknown;
  },
  report: { reporterId: string; targetType: string; targetId: string },
  open: boolean,
) {
  tx.set(
    col(COLLECTIONS.reportGuards).doc(
      guardId(report.reporterId, report.targetType, report.targetId),
    ),
    { open, updatedAt: serverNow() },
    { merge: true },
  );
}
