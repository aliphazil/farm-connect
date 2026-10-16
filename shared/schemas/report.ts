import { z } from "zod";
import { idSchema, timestampsSchema } from "./common";

export const REPORT_TARGET_TYPES = ["listing", "user"] as const;
export const REPORT_REASONS = [
  "fraud_scam",
  "fake_listing",
  "wrong_price_or_quantity",
  "non_delivery",
  "abusive_behaviour",
  "prohibited_item",
  "other",
] as const;
export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** Fraud / abuse report: `reports/{id}`. Visible to admins and the reporter. */
export const fraudReportSchema = z
  .object({
    id: idSchema,
    reporterId: idSchema,
    targetType: z.enum(REPORT_TARGET_TYPES),
    targetId: idSchema,
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().min(10).max(2000),
    status: z.enum(REPORT_STATUSES),
    resolution: z.string().max(2000).optional(),
    handledBy: idSchema.optional(),
  })
  .extend(timestampsSchema.shape);
export type FraudReport = z.infer<typeof fraudReportSchema>;

export const fraudReportInputSchema = fraudReportSchema.pick({
  targetType: true,
  targetId: true,
  reason: true,
  details: true,
});
export type FraudReportInput = z.infer<typeof fraudReportInputSchema>;
