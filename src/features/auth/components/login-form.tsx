"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { localeHref } from "@/i18n/paths";
import { signIn } from "../client";
import { authErrorKey } from "../errors";
import { useAuthRedirect } from "./use-auth-redirect";

export function LoginForm({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const redirect = useAuthRedirect(locale);
  const router = useRouter();
  const next = useSearchParams().get("next");
  const t = dict.auth;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      redirect(
        await signIn(String(form.get("email")), String(form.get("password"))),
        false,
        next,
      );
    } catch (err) {
      const key = authErrorKey(err);
      // Locked accounts go to the page that explains why and takes appeals.
      if (key === "accountBlocked" || key === "accountSuspended") {
        router.replace(localeHref(locale, "/appeal"));
        return;
      }
      console.error(err);
      setError(dict.authErrors[key]);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {error ? <Alert tone="error">{error}</Alert> : null}
      <TextField
        name="email"
        type="email"
        label={t.email}
        autoComplete="email"
        required
        inputMode="email"
      />
      <TextField
        name="password"
        type="password"
        label={t.password}
        autoComplete="current-password"
        required
      />
      <p className="-mt-2 text-sm">
        <Link
          href={localeHref(locale, "/forgot-password")}
          className="text-primary underline-offset-4 hover:underline"
        >
          {t.forgotLink}
        </Link>
      </p>
      <Button type="submit" loading={pending} loadingLabel={t.signingIn}>
        {pending ? t.signingIn : t.signInSubmit}
      </Button>
    </form>
  );
}
