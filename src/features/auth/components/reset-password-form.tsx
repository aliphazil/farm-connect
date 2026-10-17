"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { requestPasswordReset } from "../client";
import { authErrorKey } from "../errors";

/**
 * Shows the same confirmation whether or not the email has an account, so
 * the form can't be used to find out who is registered.
 */
export function ResetPasswordForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [state, setState] = useState<"idle" | "pending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const t = dict.auth;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setState("pending");
    setError(null);
    try {
      await requestPasswordReset(email, locale);
      setState("sent");
    } catch (err) {
      console.error(err);
      setError(dict.authErrors[authErrorKey(err)]);
      setState("idle");
    }
  }

  if (state === "sent") return <Alert tone="success">{t.resetSent}</Alert>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField
        name="email"
        type="email"
        inputMode="email"
        label={t.email}
        autoComplete="email"
        required
      />
      <Button
        type="submit"
        loading={state === "pending"}
        loadingLabel={t.resetSending}
      >
        {state === "pending" ? t.resetSending : t.resetSubmit}
      </Button>
    </form>
  );
}
