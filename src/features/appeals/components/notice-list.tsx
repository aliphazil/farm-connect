"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/layout-primitives";
import { AppealRequestError, sendAppeal, type NoticeData } from "../client";

const date = (v: string | Date | undefined) => (v ? new Date(v) : undefined);

const TONE = {
  active: "danger",
  expired: "neutral",
  lifted: "success",
  overturned: "success",
} as const;

/** The user's own warnings, restrictions, suspensions and blocks, with appeals. */
export function NoticeList({
  notices,
  appealsEnabled,
  dict,
  locale,
  onChanged,
}: {
  notices: NoticeData[];
  appealsEnabled: boolean;
  dict: Dictionary;
  locale: Locale;
  onChanged: () => void;
}) {
  const t = dict.notices;
  if (!notices.length)
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-6 text-center">
        <p className="font-semibold">{t.empty}</p>
        <p className="text-muted">{t.emptyBody}</p>
      </div>
    );

  return (
    <ul className="flex flex-col gap-3">
      {notices.map((n) => {
        const expires = date(n.expiresAt);
        return (
          <li
            key={n.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{t.types[n.type]}</h2>
              <Badge tone={TONE[n.status]}>{t.statuses[n.status]}</Badge>
            </div>
            <p className="text-sm text-muted">
              {fill(t.issued, {
                date: formatDate(new Date(n.createdAt), locale),
              })}
              {expires
                ? ` · ${fill(t.until, { date: formatDate(expires, locale) })}`
                : ""}
            </p>
            <p className="text-sm">
              <span className="font-medium">{t.reason}:</span> {n.reason}
            </p>
            {n.restrictions?.length ? (
              <p className="text-sm">
                {fill(t.turnedOff, {
                  list: n.restrictions
                    .map((r) => dict.admin.userDetail.restrictionLabels[r])
                    .join(", "),
                })}
              </p>
            ) : null}
            <AppealState
              notice={n}
              appealsEnabled={appealsEnabled}
              dict={dict}
              locale={locale}
              onChanged={onChanged}
            />
          </li>
        );
      })}
    </ul>
  );
}

function AppealState({
  notice,
  appealsEnabled,
  dict,
  locale,
  onChanged,
}: {
  notice: NoticeData;
  appealsEnabled: boolean;
  dict: Dictionary;
  locale: Locale;
  onChanged: () => void;
}) {
  const t = dict.notices;
  const a = notice.appeal;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = String(
      new FormData(event.currentTarget).get("appeal") ?? "",
    ).trim();
    if (message.length < 20) {
      setError(t.appealHint);
      return;
    }
    setPending(true);
    setError(null);
    try {
      await sendAppeal(notice.id, message);
      setSent(true);
      onChanged();
    } catch (err) {
      const code = err instanceof AppealRequestError ? err.code : "";
      setError(
        code in t.appealErrors
          ? t.appealErrors[code as keyof typeof t.appealErrors]
          : t.appealFailed,
      );
    } finally {
      setPending(false);
    }
  }

  const note = a.outcomeNote ? (
    <p className="text-sm">{fill(t.outcomeNote, { note: a.outcomeNote })}</p>
  ) : null;

  if (sent) return <Alert tone="success">{t.appealSent}</Alert>;
  if (a.status === "pending")
    return (
      <Alert tone="info">
        {fill(t.appealPending, {
          date: a.submittedAt
            ? formatDate(new Date(a.submittedAt), locale)
            : "",
        })}
      </Alert>
    );
  if (a.status === "upheld")
    return (
      <Alert tone="warning">
        <p>{t.appealUpheld}</p>
        {note}
      </Alert>
    );
  if (a.status === "overturned")
    return (
      <Alert tone="success">
        <p>{t.appealOverturned}</p>
        {note}
      </Alert>
    );
  if (notice.status !== "active") return null;
  if (a.heldUntilDecision)
    return (
      <Alert tone="info">
        {fill(t.appealHeld, { reason: a.heldReason ?? "" })}
      </Alert>
    );
  if (!appealsEnabled)
    return <p className="text-sm text-muted">{t.appealsDisabled}</p>;

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-2 border-t border-border pt-3"
    >
      <h3 className="text-sm font-semibold">{t.appeal}</h3>
      <p className="text-sm text-muted">{t.appealIntro}</p>
      <TextAreaField
        id={`appeal-${notice.id}`}
        name="appeal"
        label={t.appealLabel}
        hint={t.appealHint}
        minLength={20}
        maxLength={2000}
        rows={4}
        required
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          loadingLabel={dict.common.loading}
        >
          {t.submitAppeal}
        </Button>
      </div>
    </form>
  );
}
