"use client";

import { REPORT_REASONS, type ReportReason } from "@shared/schemas";
import type { Dictionary } from "@shared/i18n";
import { SelectField, TextAreaField } from "@/components/ui/form-field";
import {
  createInternalReportAction,
  decideAppealAction,
  warnUserAction,
} from "../actions";
import { ActionPanel, ConfirmAction } from "./confirm-action";

type AdminText = Dictionary["admin"];
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Optional extras for any enforcement action: internal note, paused appeal. */
export function EnforcementExtras({
  id,
  allowAppealHold,
  t,
}: {
  id: string;
  allowAppealHold: boolean;
  t: AdminText;
}) {
  const e = t.enforcement;
  return (
    <>
      <TextAreaField
        id={`${id}-internal`}
        name="internalNote"
        label={e.internalNote}
        rows={2}
        maxLength={2000}
      />
      {allowAppealHold ? (
        <>
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="hold"
              className="size-5 accent-primary"
            />
            {e.holdAppeal}
          </label>
          <TextAreaField
            id={`${id}-hold`}
            name="holdReason"
            label={e.holdReason}
            rows={2}
            maxLength={500}
          />
        </>
      ) : null}
    </>
  );
}

export const extrasFrom = (f: FormData) => ({
  internalNote: text(f, "internalNote") || undefined,
  holdAppeal: f.get("hold") === "on" ? text(f, "holdReason") : undefined,
});

/** Warn an account, or open an internal moderation record about it. */
export function AccountModerationTools({
  uid,
  canWarn,
  canRecord,
  allowAppealHold,
  reasons,
  t,
}: {
  uid: string;
  canWarn: boolean;
  canRecord: boolean;
  allowAppealHold: boolean;
  reasons: Record<ReportReason, string>;
  t: AdminText;
}) {
  const e = t.enforcement;
  const rec = t.records;
  return (
    <ActionPanel>
      <div className="flex flex-wrap gap-3">
        {canWarn ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={e.warn}
            title={e.warn}
            body={e.warnBody}
            reason="required"
            reasonLabel={e.userReason}
            fields={
              <>
                <p className="text-xs text-muted">{e.userReasonHint}</p>
                <EnforcementExtras
                  id={`warn-${uid}`}
                  allowAppealHold={allowAppealHold}
                  t={t}
                />
              </>
            }
            onConfirm={(f) =>
              warnUserAction(uid, text(f, "reason"), extrasFrom(f))
            }
            success={e.warned}
          />
        ) : null}
        {canRecord ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={rec.create}
            title={rec.create}
            body={rec.createBody}
            fields={
              <>
                <SelectField
                  id={`record-reason-${uid}`}
                  name="category"
                  label={rec.reasonLabel}
                  defaultValue="other"
                  options={REPORT_REASONS.map((r) => ({
                    value: r,
                    label: reasons[r],
                  }))}
                />
                <TextAreaField
                  id={`record-details-${uid}`}
                  name="details"
                  label={rec.detailsLabel}
                  rows={4}
                  minLength={10}
                  maxLength={2000}
                  required
                />
              </>
            }
            onConfirm={(f) =>
              createInternalReportAction({
                targetType: "user",
                targetId: uid,
                reason: String(f.get("category")) as ReportReason,
                details: text(f, "details"),
              })
            }
            success={rec.created}
          />
        ) : null}
      </div>
    </ActionPanel>
  );
}

/** Uphold or overturn a pending appeal. */
export function AppealDecision({
  actionId,
  t,
}: {
  actionId: string;
  t: AdminText;
}) {
  const a = t.appeals;
  return (
    <ActionPanel>
      <div className="flex flex-wrap gap-3">
        <ConfirmAction
          t={t}
          label={a.overturn}
          title={a.overturn}
          body={a.overturnBody}
          reason="required"
          reasonLabel={a.outcomeLabel}
          onConfirm={(f) =>
            decideAppealAction(actionId, "overturned", text(f, "reason"))
          }
          success={a.overturned}
        />
        <ConfirmAction
          t={t}
          tone="secondary"
          label={a.uphold}
          title={a.uphold}
          body={a.upholdBody}
          reason="required"
          reasonLabel={a.outcomeLabel}
          onConfirm={(f) =>
            decideAppealAction(actionId, "upheld", text(f, "reason"))
          }
          success={a.upheld}
        />
      </div>
    </ActionPanel>
  );
}
