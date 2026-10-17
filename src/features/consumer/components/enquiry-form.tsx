"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { enquiryInputSchema } from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import { sendEnquiry } from "@/services/client/interactions";
import { authErrorKey } from "@/features/auth/errors";
import { locationLabels } from "@/components/forms/labels";
import { LocationPicker } from "@/components/forms/location-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/form-field";

/**
 * Sends an enquiry about a product. Contact details are shared with the
 * farmer only when the buyer ticks the box. "Sent" means the enquiry was
 * saved and the farmer can see it — not that the farmer has replied.
 */
export function EnquiryForm({
  productId,
  unitLabel,
  minOrder,
  defaults,
  dict,
  locale,
}: {
  productId: string;
  unitLabel: string;
  minOrder?: number;
  defaults: {
    name?: string;
    phone?: string;
    atollCode?: string;
    islandId?: string;
  };
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.enquiry;
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [failure, setFailure] = useState<string | null>(null);
  const [share, setShare] = useState(Boolean(defaults.phone));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (n: string) => String(form.get(n) ?? "").trim();
    const candidate = {
      productId,
      quantity: Number(text("quantity")),
      message: text("message") || undefined,
      consumerName: share ? text("name") || undefined : undefined,
      consumerPhone: share ? text("phone") || undefined : undefined,
      deliverTo: {
        atollCode: text("deliverAtoll"),
        islandId: text("deliverIsland"),
      },
    };
    const result = enquiryInputSchema.safeParse(candidate);
    const errs: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0]);
        errs[key] ??=
          issue.message === "invalid_phone"
            ? dict.validation.invalid_phone
            : dict.validation.required;
      }
    }
    if (share && !text("phone"))
      errs.consumerPhone = dict.validation.invalid_phone;
    setErrors(errs);
    if (Object.keys(errs).length || !result.success) return;

    setState("sending");
    setFailure(null);
    try {
      await sendEnquiry(result.data);
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
          href={localeHref(locale, "/account/enquiries")}
          className="font-medium underline"
        >
          {t.viewMine}
        </Link>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t.intro}</p>
      {failure ? <Alert tone="error">{failure}</Alert> : null}
      <TextField
        name="quantity"
        type="number"
        min={minOrder ?? 0}
        step="any"
        inputMode="decimal"
        label={fill(t.quantity, { unit: unitLabel })}
        defaultValue={minOrder ?? 1}
        required
        requiredLabel={dict.common.required}
        error={errors.quantity}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">{t.deliverTo}</legend>
        <LocationPicker
          name="deliver"
          locale={locale}
          labels={locationLabels(dict)}
          required
          defaultAtoll={defaults.atollCode}
          defaultIsland={defaults.islandId}
          error={errors.deliverTo}
        />
      </fieldset>
      <TextAreaField
        name="message"
        label={t.message}
        hint={t.messageHint}
        maxLength={1000}
        rows={3}
      />
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
          className="mt-0.5 size-5 accent-primary"
        />
        {t.shareContact}
      </label>
      {share ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            name="name"
            label={t.name}
            defaultValue={defaults.name}
            maxLength={80}
            autoComplete="name"
          />
          <TextField
            name="phone"
            type="tel"
            inputMode="tel"
            label={t.phone}
            hint={dict.auth.phoneHint}
            defaultValue={defaults.phone?.replace(/^\+960/, "")}
            autoComplete="tel-national"
            error={errors.consumerPhone}
          />
        </div>
      ) : null}
      <div>
        <Button
          type="submit"
          loading={state === "sending"}
          loadingLabel={t.sending}
        >
          {state === "sending" ? t.sending : t.submit}
        </Button>
      </div>
    </form>
  );
}
