"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { SelfServiceRole } from "@shared/constants/roles";
import type { Dictionary } from "@shared/i18n";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
import { completeProfile, register } from "../client";
import { AuthFlowError, authErrorKey } from "../errors";
import { ProfileFields, readProfile, type FieldErrors } from "./profile-fields";
import { useAuthRedirect } from "./use-auth-redirect";

const MIN_PASSWORD = 8;

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Registration (`mode="register"`: email + password + profile) and
 * onboarding (`mode="onboarding"`: profile only, for a signed-in user whose
 * profile wasn't saved yet).
 */
export function RegisterForm({
  dict,
  locale,
  mode = "register",
}: {
  dict: Dictionary;
  locale: Locale;
  mode?: "register" | "onboarding";
}) {
  // "Register as a farmer" links point to #farmer and preselect that role.
  const hash = useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash,
    () => "",
  );
  const [chosenRole, setRole] = useState<SelfServiceRole | null>(null);
  const role: SelfServiceRole =
    chosenRole ?? (hash === "#farmer" ? "farmer" : "consumer");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const redirect = useAuthRedirect(locale);
  const t = dict.auth;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { profile, errors: fieldErrors } = readProfile(form, role, dict);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    if (mode === "register" && password.length < MIN_PASSWORD)
      fieldErrors.password = t.passwordTooShort;
    if (mode === "register" && !email.includes("@"))
      fieldErrors.email = dict.authErrors.invalidEmail;

    setErrors(fieldErrors);
    setFormError(null);
    if (!profile || Object.keys(fieldErrors).length > 0) {
      setFormError(dict.authErrors.invalidProfile);
      return;
    }

    setPending(true);
    try {
      redirect(
        mode === "register"
          ? await register(email, password, profile)
          : await completeProfile(profile),
        true,
      );
    } catch (err) {
      console.error(err);
      // The account was created but the profile step failed: finish it in onboarding.
      if (err instanceof AuthFlowError && err.code === "profile_incomplete") {
        redirect({ role: null });
        return;
      }
      setFormError(dict.authErrors[authErrorKey(err)]);
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {formError ? <Alert tone="error">{formError}</Alert> : null}
      {mode === "register" ? (
        <>
          <TextField
            name="email"
            type="email"
            inputMode="email"
            label={t.email}
            autoComplete="email"
            required
            requiredLabel={dict.common.required}
            error={errors.email}
          />
          <TextField
            name="password"
            type="password"
            label={t.password}
            hint={t.passwordHint}
            autoComplete="new-password"
            minLength={MIN_PASSWORD}
            required
            requiredLabel={dict.common.required}
            error={errors.password}
          />
        </>
      ) : null}
      <ProfileFields
        dict={dict}
        locale={locale}
        role={role}
        onRoleChange={setRole}
        errors={errors}
      />
      <Button
        type="submit"
        loading={pending}
        loadingLabel={mode === "register" ? t.registering : t.saving}
      >
        {pending
          ? mode === "register"
            ? t.registering
            : t.saving
          : mode === "register"
            ? t.registerSubmit
            : t.onboardingSubmit}
      </Button>
    </form>
  );
}
