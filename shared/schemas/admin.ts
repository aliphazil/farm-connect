import { z } from "zod";
import { idSchema } from "./common";

export const ADMIN_LOG_ACTIONS = [
  "admin.grant",
  "admin.revoke",
  "user.role_change",
  "user.block",
  "user.unblock",
  "user.suspend",
  "user.restore",
  "user.restrict",
  "user.warn",
  "appeal.submit",
  "appeal.decide",
  "farmer.approval",
  "product.moderation",
  "product.status",
  "payment.verification",
  "payment.reversal",
  "finance.view",
  "report.update",
  "report.create",
  "report.assign",
  "report.note",
  "report.request_info",
  "report.reply",
  "report.decision",
  "branding.publish",
  "branding.draft",
  "branding.restore",
  "featured.update",
  "content.publish",
  "reference.seed",
  "reference.update",
  "settings.update",
] as const;
export type AdminLogAction = (typeof ADMIN_LOG_ACTIONS)[number];

/**
 * `adminLogs/{id}` — append-only audit trail of every privileged operation.
 * Written only by server code / admin scripts; readable only by admins.
 * `actorId` is a uid, or "bootstrap-script" for command-line operations.
 */
export const adminLogSchema = z.object({
  id: idSchema,
  actorId: idSchema,
  action: z.enum(ADMIN_LOG_ACTIONS),
  targetType: z.string().max(40),
  targetId: idSchema,
  details: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
});
export type AdminLog = z.infer<typeof adminLogSchema>;
