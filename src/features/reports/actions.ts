"use server";

import type { FraudReportInput } from "@shared/schemas";
import { AuthorizationError, assertRole } from "@/lib/auth/session";
import {
  ReportError,
  replyToReport,
  submitReport,
  type ReportErrorCode,
} from "@/services/server/reports";

/**
 * Reporting for farmers and buyers. The session is verified here, and the
 * service enforces who may report what, duplicates, rate limits and
 * evidence rules.
 */

export type ReportActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: ReportErrorCode | "unauthorized" | "failed" };

async function run(
  work: (r: { uid: string; role: string }) => Promise<string | void>,
): Promise<ReportActionResult> {
  try {
    const user = await assertRole(["consumer", "farmer"]);
    const id = await work({ uid: user.uid, role: user.role });
    return { ok: true, ...(id ? { id } : {}) };
  } catch (error) {
    if (error instanceof AuthorizationError)
      return { ok: false, error: "unauthorized" };
    if (error instanceof ReportError) return { ok: false, error: error.code };
    console.error("Report action failed", error);
    return { ok: false, error: "failed" };
  }
}

export async function submitReportAction(input: FraudReportInput) {
  return run((reporter) => submitReport(reporter, input));
}

export async function replyToReportAction(reportId: string, body: string) {
  return run((reporter) => replyToReport(reporter, reportId, body));
}
