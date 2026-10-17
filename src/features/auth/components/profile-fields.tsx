"use client";

import Link from "next/link";
import { LOCALE_LABEL, LOCALES, type Locale } from "@shared/constants/locales";
import {
  SELF_SERVICE_ROLES,
  type SelfServiceRole,
} from "@shared/constants/roles";
import type { Dictionary } from "@shared/i18n";
import { registrationSchema, type RegistrationInput } from "@shared/schemas";
import { locationLabels } from "@/components/forms/labels";
import { LocationPicker } from "@/components/forms/location-picker";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form-field";
import { localeHref } from "@/i18n/paths";
import { cn } from "@/lib/cn";

export type FieldErrors = Partial<Record<string, string>>;

/**
 * Profile fields shared by registration and onboarding. Only "consumer" and
 * "farmer" are offered — there is no way to choose "admin" here, and the
 * server rejects it anyway.
 */
export function ProfileFields({
  dict,
  locale,
  role,
  onRoleChange,
  errors,
}: {
  dict: Dictionary;
  locale: Locale;
  role: SelfServiceRole;
  onRoleChange: (role: SelfServiceRole) => void;
  errors: FieldErrors;
}) {
  const t = dict.auth;
  const farmer = role === "farmer";

  const roleOptions = SELF_SERVICE_ROLES.map((value) => ({
    value,
    title: value === "farmer" ? t.farmerTitle : t.consumerTitle,
    body: value === "farmer" ? t.farmerBody : t.consumerBody,
  }));

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">{t.roleLegend}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {roleOptions.map((o) => (
            <label
              key={o.value}
              className={cn(
                "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors",
                role === o.value
                  ? "border-primary bg-primary-soft"
                  : "border-border hover:border-primary",
              )}
            >
              <input
                type="radio"
                name="role"
                value={o.value}
                checked={role === o.value}
                onChange={() => onRoleChange(o.value)}
                className="mt-1 size-4 accent-primary"
              />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-sm text-muted">{o.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <TextField
        name="displayName"
        label={t.displayName}
        autoComplete="name"
        required
        maxLength={80}
        requiredLabel={dict.common.required}
        error={errors.displayName}
      />

      <TextField
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        label={t.phone}
        hint={t.phoneHint}
        required={farmer}
        requiredLabel={dict.common.required}
        error={errors.phone}
      />

      {farmer ? (
        <>
          <TextField
            name="farmName"
            label={t.farmName}
            required
            maxLength={80}
            requiredLabel={dict.common.required}
            error={errors.farmName}
          />
          <TextField
            name="farmNameDv"
            label={t.farmNameDv}
            lang="dv"
            dir="rtl"
            maxLength={80}
          />
          <TextField
            name="whatsapp"
            type="tel"
            inputMode="tel"
            label={dict.farmerPortal.profile.whatsapp}
            hint={t.phoneHint}
            error={errors.whatsapp}
          />
          <TextAreaField
            name="bioEn"
            label={dict.farmerPortal.profile.descriptionEn}
            maxLength={1000}
            rows={3}
          />
          <TextAreaField
            name="bioDv"
            label={dict.farmerPortal.profile.descriptionDv}
            lang="dv"
            dir="rtl"
            maxLength={1000}
            rows={3}
          />
        </>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm text-muted">
          {farmer ? t.locationHint : t.consumerLocationHint}
        </legend>
        <LocationPicker
          name="location"
          locale={locale}
          labels={locationLabels(dict)}
          required={farmer}
          error={errors.location}
        />
        {farmer ? (
          <TextField
            name="address"
            label={dict.farmerPortal.profile.address}
            maxLength={200}
          />
        ) : null}
      </fieldset>

      <SelectField
        name="preferredLocale"
        label={t.preferredLanguage}
        defaultValue={locale}
        options={LOCALES.map((l) => ({ value: l, label: LOCALE_LABEL[l] }))}
      />

      <div>
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-0.5 size-5 accent-primary"
            aria-invalid={errors.acceptTerms ? true : undefined}
            aria-describedby={
              errors.acceptTerms ? "acceptTerms-error" : undefined
            }
          />
          <span>
            {t.acceptTerms}{" "}
            <Link
              href={localeHref(locale, "/terms")}
              target="_blank"
              className="text-primary underline"
            >
              {t.readTerms}
            </Link>
            {" · "}
            <Link
              href={localeHref(locale, "/privacy")}
              target="_blank"
              className="text-primary underline"
            >
              {t.readPrivacy}
            </Link>
          </span>
        </label>
        {errors.acceptTerms ? (
          <p id="acceptTerms-error" className="mt-1 text-sm text-danger">
            {errors.acceptTerms}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** Reads the form into a registration payload and validates it. */
export function readProfile(
  form: FormData,
  role: SelfServiceRole,
  dict: Dictionary,
): { profile?: RegistrationInput; errors: FieldErrors } {
  const text = (name: string) => String(form.get(name) ?? "").trim();
  const atollCode = text("locationAtoll");
  const islandId = text("locationIsland");
  const location = atollCode && islandId ? { atollCode, islandId } : undefined;
  const phone = text("phone") || undefined;
  const base = {
    role,
    displayName: text("displayName"),
    preferredLocale: text("preferredLocale"),
    acceptTerms: form.get("acceptTerms") === "on",
  };
  const candidate =
    role === "farmer"
      ? {
          ...base,
          phone,
          whatsapp: text("whatsapp") || undefined,
          farmName: {
            en: text("farmName"),
            dv: text("farmNameDv") || undefined,
          },
          bio:
            text("bioEn") || text("bioDv")
              ? { en: text("bioEn"), dv: text("bioDv") || undefined }
              : undefined,
          location,
          address: text("address") || undefined,
        }
      : { ...base, phone, location };

  const result = registrationSchema.safeParse(candidate);
  if (result.success)
    return { profile: candidate as RegistrationInput, errors: {} };

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? "");
    if (errors[field]) continue;
    if (field === "acceptTerms") errors[field] = dict.auth.termsRequired;
    else if (issue.message === "invalid_phone")
      errors[field] = dict.validation.invalid_phone;
    else errors[field] = dict.validation.required;
  }
  return { errors };
}
