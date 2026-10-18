import "server-only";

import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";
import {
  appealInputSchema,
  enforcementActionSchema,
  type AppealInput,
  type EnforcementAction,
} from "@shared/schemas";
import { getAdminDb } from "@/lib/firebase/admin";
import { addAdminLog, col, serverNow, snapToModel } from "./db";

/**
 * What a user may see about enforcement on their own account, and appeals.
 * Only the user's own records are returned, without internal notes or the
 * ids of the administrators involved.
 */

export type AppealErrorCode =
  | "invalid_input"
  | "not_found"
  | "already_appealed"
  | "not_appealable"
  | "appeal_held"
  | "appeals_disabled";

export class AppealError extends Error {
  constructor(public readonly code: AppealErrorCode) {
    super(code);
    this.name = "AppealError";
  }
}

export type MyNotice = Omit<
  EnforcementAction,
  "internalNote" | "createdBy" | "endedBy" | "reportId" | "userId" | "appeal"
> & {
  appeal: Omit<EnforcementAction["appeal"], "decidedBy">;
  /** The user can appeal this right now. */
  canAppeal: boolean;
};

async function appealsEnabled(): Promise<boolean> {
  const snap = await col(COLLECTIONS.siteSettings)
    .doc(SITE_SETTINGS_DOCS.moderation)
    .get();
  return snap.get("appealsEnabled") !== false;
}

function appealBlocker(
  a: Pick<EnforcementAction, "status" | "appeal">,
  enabled: boolean,
): AppealErrorCode | null {
  if (a.appeal.status !== "none") return "already_appealed";
  if (a.status !== "active") return "not_appealable";
  if (a.appeal.heldUntilDecision) return "appeal_held";
  if (!enabled) return "appeals_disabled";
  return null;
}

export async function listMyNotices(uid: string): Promise<{
  notices: MyNotice[];
  appealsEnabled: boolean;
}> {
  const [snap, enabled] = await Promise.all([
    col(COLLECTIONS.enforcementActions)
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get(),
    appealsEnabled(),
  ]);
  const notices = snap.docs
    .map((d) => {
      try {
        return snapToModel(enforcementActionSchema, d);
      } catch {
        return null;
      }
    })
    .filter((a): a is EnforcementAction => a !== null)
    .map(
      ({
        internalNote: _internal,
        createdBy: _by,
        endedBy: _endedBy,
        reportId: _report,
        userId: _user,
        appeal: { decidedBy: _decidedBy, ...appeal },
        ...rest
      }) => {
        void [_internal, _by, _endedBy, _report, _user, _decidedBy];
        const notice = { ...rest, appeal };
        return {
          ...notice,
          canAppeal: appealBlocker(notice, enabled) === null,
        };
      },
    );
  return { notices, appealsEnabled: enabled };
}

/** Whether the user has an action in force (for banners). */
export async function hasActiveNotice(uid: string): Promise<boolean> {
  const snap = await col(COLLECTIONS.enforcementActions)
    .where("userId", "==", uid)
    .where("status", "==", "active")
    .limit(1)
    .get();
  return !snap.empty;
}

/** Submits the user's appeal against one of their own enforcement actions. */
export async function submitAppeal(
  uid: string,
  input: AppealInput,
): Promise<void> {
  const parsed = appealInputSchema.safeParse(input);
  if (!parsed.success) throw new AppealError("invalid_input");
  const enabled = await appealsEnabled();
  const ref = col(COLLECTIONS.enforcementActions).doc(parsed.data.actionId);
  await getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("userId") !== uid)
      throw new AppealError("not_found");
    const blocker = appealBlocker(
      {
        status: snap.get("status"),
        appeal: snap.get("appeal") ?? { status: "none" },
      },
      enabled,
    );
    if (blocker) throw new AppealError(blocker);
    tx.update(ref, {
      "appeal.status": "pending",
      "appeal.message": parsed.data.message,
      "appeal.submittedAt": serverNow(),
    });
    addAdminLog(tx, {
      actorId: uid,
      action: "appeal.submit",
      targetType: "user",
      targetId: uid,
      details: { actionId: ref.id, type: snap.get("type") },
    });
  });
}
