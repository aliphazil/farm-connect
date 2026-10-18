"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ACCOUNT_RESTRICTIONS,
  SUSPENSION_DAYS,
  type AccountRestriction,
  type AdminPermission,
} from "@shared/constants/admin";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { ReportOutcome, ReportStatus } from "@shared/schemas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField } from "@/components/ui/form-field";
import {
  addReportNoteAction,
  assignReportAction,
  decideReportAction,
  requestReportInfoAction,
  updateReportAction,
  type AdminActionResult,
} from "../actions";
import {
  ActionPanel,
  ConfirmAction,
  resultMessage,
  type Feedback,
} from "./confirm-action";

type AdminText = Dictionary["admin"];
const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function useRun(t: AdminText) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function run(work: () => Promise<AdminActionResult>, success: string) {
    setPending(true);
    setFeedback(null);
    try {
      const res = await work();
      setFeedback(resultMessage(res, success, t));
      if (res.ok) router.refresh();
      return res.ok;
    } catch (err) {
      console.error(err);
      setFeedback({ tone: "error", text: t.errors.failed });
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, feedback, run };
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return feedback ? (
    <Alert tone={feedback.tone === "success" ? "success" : "error"}>
      {feedback.text}
    </Alert>
  ) : null;
}

/** Assign the report to yourself or another administrator. */
export function AssignControl({
  reportId,
  assigneeId,
  me,
  admins,
  t,
}: {
  reportId: string;
  assigneeId: string | null;
  me: string;
  admins: { uid: string; name: string }[];
  t: AdminText;
}) {
  const r = t.reports;
  const { pending, feedback, run } = useRun(t);
  const [value, setValue] = useState(assigneeId ?? "");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <SelectField
          id={`assign-${reportId}`}
          name="assignee"
          label={r.assignTo}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          options={[
            { value: "", label: r.unassigned },
            ...admins.map((a) => ({ value: a.uid, label: a.name })),
          ]}
        />
        <Button
          size="sm"
          variant="secondary"
          loading={pending}
          loadingLabel={t.common.working}
          onClick={() =>
            run(() => assignReportAction(reportId, value || null), r.assigned)
          }
        >
          {r.assign}
        </Button>
        {assigneeId !== me ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setValue(me);
              void run(() => assignReportAction(reportId, me), r.assigned);
            }}
          >
            {r.assignMe}
          </Button>
        ) : null}
      </div>
      <FeedbackLine feedback={feedback} />
    </div>
  );
}

/** Private admin note. */
export function AddNoteForm({
  reportId,
  t,
}: {
  reportId: string;
  t: AdminText;
}) {
  const r = t.reports;
  const { pending, feedback, run } = useRun(t);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const body = text(new FormData(formEl), "note");
    if (!body) return;
    if (await run(() => addReportNoteAction(reportId, body), r.noteAdded))
      formEl.reset();
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <TextAreaField
        id={`note-${reportId}`}
        name="note"
        label={r.noteLabel}
        rows={3}
        maxLength={4000}
        required
      />
      <FeedbackLine feedback={feedback} />
      <div>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          loading={pending}
          loadingLabel={t.common.working}
        >
          {r.addNote}
        </Button>
      </div>
    </form>
  );
}

/** Start review, ask the reporter for information, or reopen a closed report. */
export function ReviewControls({
  reportId,
  status,
  internal,
  t,
}: {
  reportId: string;
  status: ReportStatus;
  internal: boolean;
  t: AdminText;
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
            onConfirm={() => updateReportAction(reportId, "reviewing")}
            success={r.done.reviewing}
          />
        ) : null}
        {!closed && !internal ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={r.requestInfo}
            title={r.requestInfo}
            body={r.requestInfoBody}
            reason="required"
            reasonLabel={r.requestInfoLabel}
            onConfirm={(f) =>
              requestReportInfoAction(reportId, text(f, "reason"))
            }
            success={r.infoRequested}
          />
        ) : null}
        {closed ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={r.reopen}
            title={r.reopen}
            onConfirm={() => updateReportAction(reportId, "open")}
            success={r.done.open}
          />
        ) : null}
      </div>
    </ActionPanel>
  );
}

const ACCOUNT_OUTCOMES: ReportOutcome[] = [
  "warning",
  "restriction",
  "suspension",
  "block",
];

/** Record the decision (and any account action) and close the report. */
export function DecisionForm({
  reportId,
  hasReportedUser,
  hasProduct,
  permissions,
  allowAppealHold,
  t,
}: {
  reportId: string;
  hasReportedUser: boolean;
  hasProduct: boolean;
  permissions: readonly AdminPermission[];
  allowAppealHold: boolean;
  t: AdminText;
}) {
  const r = t.reports;
  const can = (p: AdminPermission) => permissions.includes(p);
  const outcomes = (
    [
      "no_action",
      "warning",
      "restriction",
      "suspension",
      "block",
      "listing_removed",
    ] as const
  ).filter((o) => {
    if (o === "no_action") return true;
    if (o === "listing_removed") return hasProduct && can("products.moderate");
    if (!hasReportedUser) return false;
    return o === "block" ? can("users.block") : can("users.moderate");
  });
  const [outcome, setOutcome] = useState<ReportOutcome>("no_action");
  const [close, setClose] = useState<"resolved" | "dismissed">("resolved");
  const [error, setError] = useState<string | null>(null);
  const { pending, feedback, run } = useRun(t);
  const days = (n: number) =>
    n === 1 ? t.userActions.dayOne : fill(t.userActions.dayMany, { count: n });
  const accountAction = ACCOUNT_OUTCOMES.includes(outcome);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const resolution = text(f, "resolution");
    const userReason = text(f, "userReason");
    if (
      resolution.length < 3 ||
      ((accountAction || outcome === "listing_removed") &&
        userReason.length < 3)
    ) {
      setError(t.common.reasonHint);
      return;
    }
    setError(null);
    await run(
      () =>
        decideReportAction(reportId, {
          close,
          resolution,
          outcome: close === "dismissed" ? "no_action" : outcome,
          userReason: userReason || undefined,
          days: Number(f.get("days")) || undefined,
          restrictions: f
            .getAll("restrictions")
            .map(String) as AccountRestriction[],
          internalNote: text(f, "internalNote") || undefined,
          holdAppeal:
            f.get("hold") === "on" ? text(f, "holdReason") : undefined,
        }),
      r.decided,
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-muted">{r.decisionBody}</p>
      <SelectField
        id={`close-${reportId}`}
        name="close"
        label={r.close}
        value={close}
        onChange={(e) => setClose(e.target.value as "resolved" | "dismissed")}
        options={[
          { value: "resolved", label: t.reports.resolve },
          { value: "dismissed", label: r.dismissInstead },
        ]}
      />
      {close === "resolved" ? (
        <SelectField
          id={`outcome-${reportId}`}
          name="outcome"
          label={r.outcome}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as ReportOutcome)}
          options={outcomes.map((o) => ({ value: o, label: r.outcomes[o] }))}
        />
      ) : null}
      {close === "resolved" &&
      (accountAction || outcome === "listing_removed") ? (
        <TextAreaField
          id={`user-reason-${reportId}`}
          name="userReason"
          label={r.userReason}
          hint={r.userReasonHint}
          rows={3}
          maxLength={1000}
          required
        />
      ) : null}
      {close === "resolved" && outcome === "suspension" ? (
        <SelectField
          id={`days-${reportId}`}
          name="days"
          label={t.userActions.days}
          defaultValue="7"
          options={SUSPENSION_DAYS.map((n) => ({
            value: String(n),
            label: days(n),
          }))}
        />
      ) : null}
      {close === "resolved" && outcome === "restriction" ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">
            {t.userDetail.restrictions}
          </legend>
          {ACCOUNT_RESTRICTIONS.map((x) => (
            <label key={x} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                name="restrictions"
                value={x}
                className="size-5 accent-primary"
              />
              {t.userDetail.restrictionLabels[x]}
            </label>
          ))}
        </fieldset>
      ) : null}
      {close === "resolved" && accountAction ? (
        <>
          <TextAreaField
            id={`internal-${reportId}`}
            name="internalNote"
            label={t.enforcement.internalNote}
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
                {t.enforcement.holdAppeal}
              </label>
              <TextAreaField
                id={`hold-${reportId}`}
                name="holdReason"
                label={t.enforcement.holdReason}
                rows={2}
                maxLength={500}
              />
            </>
          ) : null}
        </>
      ) : null}
      <TextAreaField
        id={`resolution-${reportId}`}
        name="resolution"
        label={t.reports.outcomeLabel}
        rows={3}
        maxLength={2000}
        required
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <FeedbackLine feedback={feedback} />
      <div>
        <Button
          type="submit"
          variant={
            close === "resolved" && outcome !== "no_action"
              ? "danger"
              : "primary"
          }
          loading={pending}
          loadingLabel={t.common.working}
        >
          {r.decide}
        </Button>
      </div>
    </form>
  );
}
