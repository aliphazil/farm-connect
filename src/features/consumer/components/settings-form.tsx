"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LOCALE_LABEL, LOCALES, type Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import {
  locationSchema,
  userSelfUpdateSchema,
  type Location,
} from "@shared/schemas";
import { saveMySettings } from "@/services/client/account";
import { requestPasswordReset, signOut } from "@/features/auth/client";
import { authErrorKey } from "@/features/auth/errors";
import { locationLabels } from "@/components/forms/labels";
import { LocationPicker } from "@/components/forms/location-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";

type Errors = Partial<Record<string, string>>;

export function SettingsForm({
  account,
  consumer,
  dict,
  locale,
}: {
  account: {
    displayName: string;
    email?: string;
    phone?: string;
    preferredLocale: Locale;
  };
  /** Null for farmers using the buyer portal (they have no buyer profile). */
  consumer: {
    defaultDeliveryLocation?: Location;
    marketingOptIn: boolean;
  } | null;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.account.settings;
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [resetState, setResetState] = useState<
    "idle" | "sending" | "sent" | "failed"
  >("idle");
  const [signingOut, setSigningOut] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (n: string) => String(form.get(n) ?? "").trim();
    const errs: Errors = {};
    const phone = text("phone");
    const parsed = userSelfUpdateSchema.safeParse({
      displayName: text("displayName"),
      phone: phone || undefined,
      preferredLocale: text("preferredLocale"),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        errs[key] ??=
          issue.message === "invalid_phone"
            ? dict.validation.invalid_phone
            : dict.validation.required;
      }
    }
    let deliveryLocation: Location | undefined;
    const atollCode = text("preferredAtoll");
    const islandId = text("preferredIsland");
    if (consumer && (atollCode || islandId)) {
      const loc = locationSchema.safeParse({ atollCode, islandId });
      if (loc.success) deliveryLocation = loc.data;
      else errs.preferred = dict.validation.required;
    }
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.success) return;

    setPending(true);
    setStatus(null);
    try {
      await saveMySettings(parsed.data, {
        clearPhone: !phone && Boolean(account.phone),
        consumer: consumer
          ? {
              marketingOptIn: form.get("marketingOptIn") === "on",
              defaultDeliveryLocation: deliveryLocation,
            }
          : undefined,
      });
      setStatus({ tone: "success", text: t.saved });
      router.refresh();
    } catch (err) {
      console.error(err);
      setStatus({
        tone: "error",
        text:
          authErrorKey(err) === "sessionExpired"
            ? dict.authErrors.sessionExpired
            : t.failed,
      });
    } finally {
      setPending(false);
    }
  }

  async function sendReset() {
    if (!account.email) return;
    setResetState("sending");
    try {
      await requestPasswordReset(account.email, locale);
      setResetState("sent");
    } catch (err) {
      console.error(err);
      setResetState("failed");
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      router.replace(`/${locale}`);
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex max-w-xl flex-col gap-4"
      >
        {status ? <Alert tone={status.tone}>{status.text}</Alert> : null}
        <TextField
          name="displayName"
          label={t.name}
          defaultValue={account.displayName}
          maxLength={80}
          required
          requiredLabel={dict.common.required}
          autoComplete="name"
          error={errors.displayName}
        />
        {account.email ? (
          <TextField
            name="email"
            label={t.email}
            defaultValue={account.email}
            readOnly
            disabled
          />
        ) : null}
        <TextField
          name="phone"
          type="tel"
          inputMode="tel"
          label={t.phone}
          hint={dict.auth.phoneHint}
          defaultValue={account.phone?.replace(/^\+960/, "")}
          autoComplete="tel-national"
          error={errors.phone}
        />
        <SelectField
          name="preferredLocale"
          label={t.language}
          defaultValue={account.preferredLocale}
          options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABEL[l] }))}
        />
        {consumer ? (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">
                {t.preferredIsland}
              </legend>
              <p className="text-sm text-muted">{t.preferredIslandHint}</p>
              <LocationPicker
                name="preferred"
                locale={locale}
                labels={locationLabels(dict)}
                defaultAtoll={consumer.defaultDeliveryLocation?.atollCode}
                defaultIsland={consumer.defaultDeliveryLocation?.islandId}
                error={errors.preferred}
              />
            </fieldset>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="marketingOptIn"
                defaultChecked={consumer.marketingOptIn}
                className="mt-0.5 size-5 accent-primary"
              />
              {t.marketing}
            </label>
          </>
        ) : (
          <Alert tone="info">{t.farmerNote}</Alert>
        )}
        <div>
          <Button
            type="submit"
            loading={pending}
            loadingLabel={dict.common.loading}
          >
            {t.save}
          </Button>
        </div>
      </form>

      {account.email ? (
        <section
          aria-labelledby="password"
          className="flex max-w-xl flex-col gap-2 border-t border-border pt-6"
        >
          <h2 id="password" className="font-semibold">
            {t.password}
          </h2>
          <p className="text-sm text-muted">{t.passwordBody}</p>
          {resetState === "sent" ? (
            <Alert tone="success">{t.resetSent}</Alert>
          ) : null}
          {resetState === "failed" ? (
            <Alert tone="error">{t.failed}</Alert>
          ) : null}
          <div>
            <Button
              variant="secondary"
              onClick={sendReset}
              loading={resetState === "sending"}
              loadingLabel={dict.common.loading}
            >
              {t.sendReset}
            </Button>
          </div>
        </section>
      ) : null}

      <section className="max-w-xl border-t border-border pt-6">
        <Button variant="ghost" onClick={onSignOut} disabled={signingOut}>
          {t.signOut}
        </Button>
      </section>
    </div>
  );
}
