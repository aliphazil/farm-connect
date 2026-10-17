"use client";

import type { Dictionary } from "@shared/i18n";
import type { ReportStatus } from "@shared/schemas";
import { updateReportAction } from "../actions";
import { ActionPanel, ConfirmAction } from "./confirm-action";

const reasonOf = (form: FormData) => String(form.get("reason") ?? "").trim();

/** Review steps for a report: start review, resolve, dismiss, reopen. */
export function ReportActions({
  reportId,
  status,
  t,
}: {
  reportId: string;
  status: ReportStatus;
  t: Dictionary["admin"];
}) {
  const r = t.reports;
  const closed = status === "resolved" || status === "dismissed";
  return (
    <ActionPanel>
      <div className="flex flex-wrap gap-3">
        {status === "open" ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={r.markReviewing}
            title={r.markReviewing}
            reason="optional"
            onConfirm={(f) =>
              updateReportAction(
                reportId,
                "reviewing",
                reasonOf(f) || undefined,
              )
            }
            success={r.done.reviewing}
          />
        ) : null}
        {!closed ? (
          <>
            <ConfirmAction
              t={t}
              label={r.resolve}
              title={r.resolve}
              body={r.resolveConfirm}
              reason="required"
              reasonLabel={r.outcomeLabel}
              onConfirm={(f) =>
                updateReportAction(reportId, "resolved", reasonOf(f))
              }
              success={r.done.resolved}
            />
            <ConfirmAction
              t={t}
              tone="secondary"
              label={r.dismiss}
              title={r.dismiss}
              body={r.dismissConfirm}
              reason="required"
              reasonLabel={r.outcomeLabel}
              onConfirm={(f) =>
                updateReportAction(reportId, "dismissed", reasonOf(f))
              }
              success={r.done.dismissed}
            />
          </>
        ) : (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={r.reopen}
            title={r.reopen}
            reason="optional"
            onConfirm={(f) =>
              updateReportAction(reportId, "open", reasonOf(f) || undefined)
            }
            success={r.done.open}
          />
        )}
      </div>
    </ActionPanel>
  );
}
