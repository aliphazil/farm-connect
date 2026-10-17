"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fraudReportInputSchema, REPORT_REASONS } from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import { submitReport } from "@/services/client/interactions";
import { authErrorKey } from "@/features/auth/errors";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField } from "@/components/ui/form-field";

/** Report a product or a farm. Private to the reporter and admins. */
export function ReportForm({
  targetType,
  targetId,
  dict,
  locale,
}: {
  targetType: "product" | "farmer";
  targetId: string;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.report;
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = fraudReportInputSchema.safeParse({
      targetType,
      targetId,
      reason: String(form.get("reason") ?? ""),
      details: String(form.get("details") ?? "").trim(),
    });
    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        errs[key] ??=
          key === "details" ? t.detailsHint : dict.validation.required;
      }
      setErrors(errs);
      return;
    }
    setErrors({});
    setState("sending");
    setFailure(null);
    try {
      await submitReport(result.data);
      setState("sent");
    } catch (err) {
      console.error(err);
      setFailure(
        authErrorKey(err) === "sessionExpired"
          ? dict.authErrors.sessionExpired
          : t.failed,
      );
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <Alert tone="success">
        {t.sent}{" "}
        <Link
          href={localeHref(locale, "/account/reports")}
          className="font-medium underline"
        >
          {dict.account.nav.reports}
        </Link>
      </Alert>
    );
  }

  if (!open) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="self-start text-danger"
        onClick={() => setOpen(true)}
        aria-expanded={false}
      >
        {targetType === "product" ? t.productTitle : t.farmerTitle}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
    >
      <p className="font-semibold">
        {targetType === "product" ? t.productTitle : t.farmerTitle}
      </p>
      <p className="text-sm text-muted">{t.intro}</p>
      {failure ? <Alert tone="error">{failure}</Alert> : null}
      <SelectField
        name="reason"
        label={t.reason}
        placeholder={t.chooseReason}
        required
        requiredLabel={dict.common.required}
        error={errors.reason}
        options={REPORT_REASONS.map((r) => ({ value: r, label: t.reasons[r] }))}
      />
      <TextAreaField
        name="details"
        label={t.details}
        hint={t.detailsHint}
        maxLength={2000}
        rows={4}
        required
        requiredLabel={dict.common.required}
        error={errors.details}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="danger"
          loading={state === "sending"}
          loadingLabel={t.sending}
        >
          {state === "sending" ? t.sending : t.submit}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {dict.common.cancel}
        </Button>
        <Link
          href={localeHref(locale, "/reporting")}
          className="text-sm text-primary underline"
        >
          {t.guidance}
        </Link>
      </div>
    </form>
  );
}
