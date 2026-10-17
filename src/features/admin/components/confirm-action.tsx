"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Dictionary } from "@shared/i18n";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/form-field";
import type { AdminActionResult } from "../actions";

type AdminText = Dictionary["admin"];

export type Feedback = { tone: "success" | "error"; text: string } | null;

/** Turns an action result into a message in the admin's language. */
export function resultMessage(
  result: AdminActionResult,
  success: string,
  t: AdminText,
): Feedback {
  return result.ok
    ? { tone: "success", text: success }
    : { tone: "error", text: t.errors[result.error] ?? t.errors.failed };
}

const PanelFeedback = createContext<((f: Feedback) => void) | null>(null);

/**
 * Groups related actions and shows their outcome in one place that stays on
 * screen after the page refreshes (when the button that ran the action may
 * disappear, e.g. "Suspend" once the account is suspended).
 */
export function ActionPanel({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  return (
    <PanelFeedback.Provider value={setFeedback}>
      <div className="flex flex-col gap-4">
        {feedback ? (
          <Alert tone={feedback.tone === "success" ? "success" : "error"}>
            {feedback.text}
          </Alert>
        ) : null}
        {children}
      </div>
    </PanelFeedback.Provider>
  );
}

/**
 * A button that opens a confirmation dialog (native <dialog>: focus moves
 * into it, Escape cancels), optionally asks for a reason and extra fields,
 * runs the action, then shows the outcome and refreshes the page data.
 */
export function ConfirmAction({
  label,
  title,
  body,
  confirmLabel,
  tone = "primary",
  reason = "none",
  reasonLabel,
  fields,
  onConfirm,
  success,
  t,
  size = "sm",
}: {
  label: string;
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  tone?: "primary" | "secondary" | "danger";
  /** "required": at least 3 characters (checked again on the server). */
  reason?: "none" | "optional" | "required";
  reasonLabel?: string;
  /** Extra inputs rendered inside the dialog's form (read from FormData). */
  fields?: ReactNode;
  onConfirm: (form: FormData) => Promise<AdminActionResult>;
  success: string | ((result: AdminActionResult) => string);
  t: AdminText;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFeedback, setLocalFeedback] = useState<Feedback>(null);
  const panel = useContext(PanelFeedback);
  const setFeedback = panel ?? setLocalFeedback;

  function open() {
    setError(null);
    setFeedback(null);
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    if (
      reason === "required" &&
      String(form.get("reason") ?? "").trim().length < 3
    ) {
      setError(t.common.reasonHint);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await onConfirm(form);
      if (result.ok) {
        dialog.current?.close();
        formEl.reset();
        setFeedback(
          resultMessage(
            result,
            typeof success === "function" ? success(result) : success,
            t,
          ),
        );
        router.refresh();
      } else {
        setError(resultMessage(result, "", t)?.text ?? t.errors.failed);
      }
    } catch (err) {
      console.error(err);
      setError(t.errors.failed);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={tone}
        size={size}
        onClick={open}
        aria-haspopup="dialog"
        className="self-start"
      >
        {label}
      </Button>
      {!panel && localFeedback ? (
        <Alert tone={localFeedback.tone === "success" ? "success" : "error"}>
          {localFeedback.text}
        </Alert>
      ) : null}
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-5">
          <h2 id={`${id}-title`} className="text-lg font-semibold">
            {title}
          </h2>
          {body ? <div className="text-sm text-muted">{body}</div> : null}
          {fields}
          {reason !== "none" ? (
            <TextAreaField
              id={`${id}-reason`}
              name="reason"
              label={
                reasonLabel ??
                (reason === "required"
                  ? t.common.reason
                  : t.common.optionalNote)
              }
              hint={reason === "required" ? t.common.reasonHint : undefined}
              required={reason === "required"}
              maxLength={500}
              rows={3}
            />
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => dialog.current?.close()}
              disabled={pending}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              variant={tone === "danger" ? "danger" : "primary"}
              loading={pending}
              loadingLabel={t.common.working}
            >
              {confirmLabel ?? t.common.confirm}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
