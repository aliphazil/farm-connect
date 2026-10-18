import { z } from "zod";
import { idSchema, timestampsSchema } from "./common";

/**
 * What a report is about. The reported user is always resolved by the server:
 * product → its farmer; farmer → that farmer; user → that account; enquiry →
 * the other party of the enquiry.
 */
export const REPORT_TARGET_TYPES = [
  "product",
  "user",
  "farmer",
  "enquiry",
] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "fraud_scam",
  "harassment",
  "misleading_information",
  "fake_listing",
  "wrong_price_or_quantity",
  "non_delivery",
  "abusive_behaviour",
  "spam",
  "prohibited_item",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/**
 * Stored values (kept from earlier phases so no data needs migrating):
 * open = "Pending", reviewing = "Under review", awaiting_info = "Awaiting
 * information" (an admin asked the reporter for more), resolved, dismissed.
 */
export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "awaiting_info",
  "resolved",
  "dismissed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export const OPEN_REPORT_STATUSES = [
  "open",
  "reviewing",
  "awaiting_info",
] as const;

/** Outcome recorded when a report is closed. */
export const REPORT_OUTCOMES = [
  "no_action",
  "warning",
  "restriction",
  "suspension",
  "block",
  "listing_removed",
] as const;
export type ReportOutcome = (typeof REPORT_OUTCOMES)[number];

/** Evidence files: reportEvidence/{reporterId}/{fileName}, at most 3 per report. */
export const MAX_REPORT_EVIDENCE = 3;

/**
 * Fraud / abuse report: `reports/{id}`. Created by server code (rate limits,
 * duplicate checks, target validation); readable only by the reporter and
 * admins — never by the reported party. Internal notes live in the
 * admin-only `reports/{id}/notes` subcollection; messages between admins and
 * the reporter in `reports/{id}/messages`.
 */
export const fraudReportSchema = z
  .object({
    id: idSchema,
    reporterId: idSchema,
    reporterRole: z.enum(["consumer", "farmer", "admin"]).optional(),
    /** True for records an administrator created themselves. */
    internal: z.boolean().optional(),
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: idSchema,
    /** The account the report is about (resolved by the server). */
    reportedUserId: idSchema.optional(),
    productId: idSchema.optional(),
    enquiryId: idSchema.optional(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().min(10).max(2000),
    evidencePaths: z
      .array(z.string().max(300))
      .max(MAX_REPORT_EVIDENCE)
      .optional(),
    status: z.enum(REPORT_STATUSES),
    /** Stored as null when unassigned, so "unassigned" can be queried. */
    assigneeId: idSchema.nullable().optional(),
    /** Outcome note shown to the reporter. */
    resolution: z.string().max(2000).optional(),
    outcome: z.enum(REPORT_OUTCOMES).optional(),
    enforcementActionId: idSchema.optional(),
    handledBy: idSchema.optional(),
    closedAt: z.date().optional(),
    /** Replies the reporter has sent (capped). */
    reporterReplies: z.number().int().nonnegative().optional(),
  })
  .extend(timestampsSchema.shape);
export type FraudReport = z.infer<typeof fraudReportSchema>;

export const fraudReportInputSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().min(10).max(2000),
  evidencePaths: z
    .array(z.string().max(300))
    .max(MAX_REPORT_EVIDENCE)
    .optional(),
});
export type FraudReportInput = z.infer<typeof fraudReportInputSchema>;

/** `reports/{id}/messages/{id}` — admin ↔ reporter (requests for information, replies). */
export const reportMessageSchema = z.object({
  id: idSchema,
  author: z.enum(["admin", "reporter"]),
  authorId: idSchema,
  body: z.string().trim().min(1).max(2000),
  createdAt: z.date(),
});
export type ReportMessage = z.infer<typeof reportMessageSchema>;

/** `reports/{id}/notes/{id}` — private admin notes. Never shown to reporter or reported party. */
export const reportNoteSchema = z.object({
  id: idSchema,
  authorId: idSchema,
  body: z.string().trim().min(1).max(4000),
  createdAt: z.date(),
});
export type ReportNote = z.infer<typeof reportNoteSchema>;

export const MODERATION_ACTIONS = [
  "user.block",
  "user.unblock",
  "user.suspend",
  "user.restore",
  "user.restrict",
  "user.warn",
  "appeal.uphold",
  "appeal.overturn",
  "farmer.approve",
  "farmer.reject",
  "farmer.verify",
  "product.approve",
  "product.reject",
  "product.remove",
  "product.restore",
  "product.deactivate",
  "report.review",
  "report.assign",
  "report.request_info",
  "report.resolve",
  "report.dismiss",
] as const;
export type ModerationActionType = (typeof MODERATION_ACTIONS)[number];

/**
 * `moderationActions/{id}` — what an admin did to a user or piece of content,
 * and why. Append-only, server-written, admin-readable.
 */
export const moderationActionSchema = z.object({
  id: idSchema,
  actorId: idSchema,
  action: z.enum(MODERATION_ACTIONS),
  targetType: z.enum(["user", "farmer", "product", "report"]),
  targetId: idSchema,
  reason: z.string().max(1000).optional(),
  reportId: idSchema.optional(),
  /** End of a suspension, when the action is one. */
  until: z.date().optional(),
  /** Restrictions in force after a user.restrict action. */
  restrictions: z.array(z.string().max(40)).max(10).optional(),
  createdAt: z.date(),
});
export type ModerationAction = z.infer<typeof moderationActionSchema>;
