"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import {
  MAX_REPORT_EVIDENCE,
  REPORT_REASONS,
  fraudReportInputSchema,
  type ReportTargetType,
} from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import { checkEvidence, uploadReportEvidence } from "@/services/client/uploads";
import { submitReportAction } from "@/features/reports/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField } from "@/components/ui/form-field";

/**
 * Report a listing, a farm, a buyer or an enquiry. Submitted to the server,
 * which checks who may report what, duplicates, rate limits and evidence.
 * The reported person never sees the report or who sent it.
 */
export function ReportForm({
  targetType,
  targetId,
  dict,
  locale,
}: {
  targetType: ReportTargetType;
  targetId: string;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.report;
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<"idle" | "uploading" | "sending" | "sent">(
    "idle",
  );
  const [failure, setFailure] = useState<string | null>(null);
  const title =
    targetType === "product"
      ? t.productTitle
      : targetType === "farmer"
        ? t.farmerTitle
        : targetType === "enquiry"
          ? t.enquiryTitle
          : t.userTitle;

  function pickFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length > MAX_REPORT_EVIDENCE) {
      setErrors((e) => ({ ...e, evidence: t.evidenceTooMany }));
      return;
    }
    const bad = picked.find((f) => checkEvidence(f));
    if (bad) {
      setErrors((e) => ({
        ...e,
        evidence: fill(t.evidenceBad, { name: bad.name }),
      }));
      return;
    }
    setErrors((e) => ({ ...e, evidence: undefined }));
    setFiles(picked);
  }

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
    setFailure(null);
    try {
      setState("uploading");
      const evidencePaths: string[] = [];
      for (const file of files)
        evidencePaths.push(await uploadReportEvidence(file));
      setState("sending");
      const res = await submitReportAction({ ...result.data, evidencePaths });
      if (res.ok) {
        setState("sent");
        return;
      }
      setFailure(
        res.error === "unauthorized"
          ? dict.authErrors.sessionExpired
          : res.error in t.errors
            ? t.errors[res.error as keyof typeof t.errors]
            : t.failed,
      );
    } catch (err) {
      console.error(err);
      setFailure(t.failed);
    }
    setState("idle");
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
        {title}
      </Button>
    );
  }

  const busy = state === "uploading" || state === "sending";
  const fid = `report-${targetType}-${targetId}`;
  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
    >
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted">{t.intro}</p>
      <p className="text-sm text-muted">{t.privacy}</p>
      {failure ? <Alert tone="error">{failure}</Alert> : null}
      <SelectField
        id={`${fid}-reason`}
        name="reason"
        label={t.reason}
        placeholder={t.chooseReason}
        required
        requiredLabel={dict.common.required}
        error={errors.reason}
        options={REPORT_REASONS.map((r) => ({ value: r, label: t.reasons[r] }))}
      />
      <TextAreaField
        id={`${fid}-details`}
        name="details"
        label={t.details}
        hint={t.detailsHint}
        maxLength={2000}
        rows={4}
        required
        requiredLabel={dict.common.required}
        error={errors.details}
      />
      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor={`${fid}-evidence`} className="font-medium">
          {t.evidence}
        </label>
        <input
          id={`${fid}-evidence`}
          type="file"
          name="evidence"
          multiple
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => pickFiles(e.target.files)}
          aria-describedby={`${fid}-evidence-hint`}
        />
        <span id={`${fid}-evidence-hint`} className="text-muted">
          {t.evidenceHint}
        </span>
        {errors.evidence ? (
          <span role="alert" className="text-danger">
            {errors.evidence}
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          variant="danger"
          loading={busy}
          loadingLabel={state === "uploading" ? t.uploading : t.sending}
        >
          {state === "uploading"
            ? t.uploading
            : state === "sending"
              ? t.sending
              : t.submit}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
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
