"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Dictionary } from "@shared/i18n";
import { replyToReportAction } from "@/features/reports/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/form-field";

/** The reporter answers an administrator's question about their report. */
export function ReportReply({
  reportId,
  dict,
}: {
  reportId: string;
  dict: Dictionary;
}) {
  const t = dict.accountReports;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const body = String(new FormData(formEl).get("reply") ?? "").trim();
    if (!body) return;
    setPending(true);
    setFeedback(null);
    const res = await replyToReportAction(reportId, body).catch(() => null);
    setPending(false);
    if (res?.ok) {
      formEl.reset();
      setFeedback({ ok: true, text: t.replySent });
      router.refresh();
    } else setFeedback({ ok: false, text: t.replyFailed });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <TextAreaField
        id={`reply-${reportId}`}
        name="reply"
        label={t.replyLabel}
        required
        maxLength={2000}
        rows={3}
      />
      {feedback ? (
        <Alert tone={feedback.ok ? "success" : "error"}>{feedback.text}</Alert>
      ) : null}
      <div>
        <Button
          type="submit"
          size="sm"
          loading={pending}
          loadingLabel={dict.common.loading}
        >
          {t.reply}
        </Button>
      </div>
    </form>
  );
}
