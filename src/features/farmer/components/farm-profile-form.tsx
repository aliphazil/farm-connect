"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import {
  farmerProfileUpdateSchema,
  mapLocationSchema,
  userSelfUpdateSchema,
  type FarmerProfile,
} from "@shared/schemas";
import { storageObjectUrl } from "@/features/catalog/images";
import {
  saveMyFarmerProfile,
  updateMyAccount,
  type ClearableFarmField,
} from "@/services/client/account";
import { syncProductsWithFarm } from "@/services/client/products";
import {
  checkImage,
  deleteStoredFile,
  shrinkImage,
  uploadFarmLogo,
} from "@/services/client/uploads";
import { locationLabels } from "@/components/forms/labels";
import { LocationPicker } from "@/components/forms/location-picker";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { TextAreaField, TextField } from "@/components/ui/form-field";
import { authErrorKey } from "@/features/auth/errors";
import { refreshCatalogAction } from "../actions";

type Errors = Partial<Record<string, string>>;

export function FarmProfileForm({
  farm,
  fullName,
  email,
  dict,
  locale,
}: {
  farm: FarmerProfile;
  fullName: string;
  email?: string;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.farmerPortal.profile;
  const router = useRouter();
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [logo, setLogo] = useState<{
    path?: string;
    file?: File;
    preview?: string;
  }>({ path: farm.logoPath });
  const [coords, setCoords] = useState({
    lat: farm.mapLocation?.lat?.toString() ?? "",
    lng: farm.mapLocation?.lng?.toString() ?? "",
  });
  const [locating, setLocating] = useState(false);

  function locateMe() {
    if (!navigator.geolocation)
      return setStatus({ tone: "error", text: t.locationFailed });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        });
        setLocating(false);
      },
      () => {
        setStatus({ tone: "error", text: t.locationFailed });
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function pickLogo(file?: File) {
    if (!file) return;
    const problem = checkImage(file);
    if (problem) {
      setErrors((e) => ({
        ...e,
        logo:
          problem === "type"
            ? dict.farmerPortal.form.imageWrongType.replace("{name}", file.name)
            : dict.farmerPortal.form.imageTooLarge.replace("{name}", file.name),
      }));
      return;
    }
    setErrors((e) => ({ ...e, logo: undefined }));
    setLogo({ file, preview: URL.createObjectURL(file) });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (n: string) => String(form.get(n) ?? "").trim();
    const errs: Errors = {};

    const atollCode = text("locationAtoll");
    const islandId = text("locationIsland");
    const map =
      coords.lat || coords.lng
        ? mapLocationSchema.safeParse({
            lat: Number(coords.lat),
            lng: Number(coords.lng),
          })
        : null;
    if (map && !map.success) errs.map = t.mapInvalid;

    const bio =
      text("bioEn") || text("bioDv")
        ? { en: text("bioEn"), dv: text("bioDv") || undefined }
        : undefined;
    const update = farmerProfileUpdateSchema.safeParse({
      farmName: { en: text("farmNameEn"), dv: text("farmNameDv") || undefined },
      bio,
      location: { atollCode, islandId },
      contact: {
        phone: text("phone"),
        whatsapp: text("whatsapp") || undefined,
      },
      address: text("address") || undefined,
      mapLocation: map?.success ? map.data : undefined,
    });
    const account = userSelfUpdateSchema.safeParse({
      displayName: text("fullName"),
    });
    if (!update.success) {
      for (const issue of update.error.issues) {
        const key =
          String(issue.path[0]) === "contact"
            ? String(issue.path[1])
            : String(issue.path[0]);
        errs[key] ??=
          issue.message === "invalid_phone"
            ? dict.validation.invalid_phone
            : dict.validation.required;
      }
    }
    if (!account.success) errs.fullName = dict.validation.required;
    setErrors(errs);
    setStatus(null);
    if (Object.keys(errs).length || !update.success || !account.success) {
      setStatus({ tone: "error", text: dict.farmerPortal.form.fixErrors });
      return;
    }

    setPending(true);
    try {
      let logoPath = logo.path;
      if (logo.file)
        logoPath = await uploadFarmLogo(await shrinkImage(logo.file));
      const clear: ClearableFarmField[] = [];
      if (!bio && farm.bio) clear.push("bio");
      if (!update.data.address && farm.address) clear.push("address");
      if (!update.data.mapLocation && farm.mapLocation)
        clear.push("mapLocation");
      if (!logoPath && farm.logoPath) clear.push("logoPath");

      await updateMyAccount(account.data);
      await saveMyFarmerProfile({ ...update.data, logoPath }, clear);
      if (farm.logoPath && farm.logoPath !== logoPath)
        await deleteStoredFile(farm.logoPath).catch(() => undefined);
      const moved =
        farm.location.atollCode !== atollCode ||
        farm.location.islandId !== islandId;
      if (moved) await syncProductsWithFarm();
      await refreshCatalogAction().catch(() => undefined);
      setLogo({ path: logoPath });
      setStatus({ tone: "success", text: t.saved });
      router.refresh();
    } catch (err) {
      console.error(err);
      setStatus({
        tone: "error",
        text:
          authErrorKey(err) === "sessionExpired"
            ? dict.authErrors.sessionExpired
            : dict.farmerPortal.form.saveFailed,
      });
    } finally {
      setPending(false);
    }
  }

  const logoSrc =
    logo.preview ?? (logo.path ? storageObjectUrl(logo.path) : null);
  const mapUrl =
    coords.lat && coords.lng
      ? `https://www.google.com/maps?q=${encodeURIComponent(`${coords.lat},${coords.lng}`)}`
      : null;

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex max-w-2xl flex-col gap-8"
    >
      {status ? (
        <Alert tone={status.tone} className="sticky top-2 z-10">
          {status.text}
        </Alert>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.yourDetails}</h2>
        <TextField
          name="fullName"
          label={t.fullName}
          defaultValue={fullName}
          autoComplete="name"
          required
          requiredLabel={dict.common.required}
          error={errors.fullName}
        />
        <TextField
          name="email"
          label={t.email}
          hint={t.emailHint}
          defaultValue={email}
          readOnly
          disabled
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.logoTitle}</h2>
        <div className="flex items-center gap-4">
          <div className="size-24 shrink-0 overflow-hidden rounded-full border border-border bg-primary-soft">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- local preview or Storage URL
              <img src={logoSrc} alt="" className="size-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label
              className={`${buttonClasses("secondary", "sm")} cursor-pointer`}
            >
              {logoSrc ? t.replaceLogo : t.uploadLogo}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-describedby="logo-hint"
                onChange={(e) => pickLogo(e.target.files?.[0])}
              />
            </label>
            {logoSrc ? (
              <Button
                size="sm"
                variant="ghost"
                className="text-danger"
                onClick={() => setLogo({})}
              >
                {t.removeLogo}
              </Button>
            ) : null}
            <p id="logo-hint" className="text-xs text-muted">
              {t.logoHint}
            </p>
            {errors.logo ? (
              <p role="alert" className="text-sm text-danger">
                {errors.logo}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.farmDetails}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            name="farmNameEn"
            label={t.farmNameEn}
            defaultValue={farm.farmName.en}
            maxLength={80}
            error={errors.farmName}
          />
          <TextField
            name="farmNameDv"
            label={t.farmNameDv}
            defaultValue={farm.farmName.dv}
            maxLength={80}
            lang="dv"
            dir="rtl"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            name="phone"
            type="tel"
            inputMode="tel"
            label={t.phone}
            hint={dict.auth.phoneHint}
            defaultValue={farm.contact.phone.replace(/^\+960/, "")}
            required
            requiredLabel={dict.common.required}
            error={errors.phone}
          />
          <TextField
            name="whatsapp"
            type="tel"
            inputMode="tel"
            label={t.whatsapp}
            defaultValue={farm.contact.whatsapp?.replace(/^\+960/, "")}
            error={errors.whatsapp}
          />
        </div>
        <TextAreaField
          name="bioEn"
          label={t.descriptionEn}
          defaultValue={farm.bio?.en}
          maxLength={1000}
        />
        <TextAreaField
          name="bioDv"
          label={t.descriptionDv}
          defaultValue={farm.bio?.dv}
          maxLength={1000}
          lang="dv"
          dir="rtl"
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t.location}</h2>
        <p className="text-sm text-muted">{t.locationNote}</p>
        <LocationPicker
          name="location"
          locale={locale}
          labels={locationLabels(dict)}
          required
          defaultAtoll={farm.location.atollCode}
          defaultIsland={farm.location.islandId}
          error={errors.location}
        />
        <TextField
          name="address"
          label={t.address}
          defaultValue={farm.address}
          maxLength={200}
        />
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-medium">{t.mapTitle}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              name="lat"
              label={t.latitude}
              inputMode="decimal"
              value={coords.lat}
              onChange={(e) =>
                setCoords((c) => ({ ...c, lat: e.target.value }))
              }
              error={errors.map}
            />
            <TextField
              name="lng"
              label={t.longitude}
              inputMode="decimal"
              value={coords.lng}
              onChange={(e) =>
                setCoords((c) => ({ ...c, lng: e.target.value }))
              }
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={locateMe}
              loading={locating}
              loadingLabel={t.locating}
            >
              {locating ? t.locating : t.useMyLocation}
            </Button>
            {mapUrl ? (
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm text-primary underline"
              >
                {t.openMap}
                <span className="sr-only"> {dict.common.opensNewTab}</span>
              </a>
            ) : null}
          </div>
        </fieldset>
      </section>

      <div>
        <Button
          type="submit"
          loading={pending}
          loadingLabel={dict.farmerPortal.form.saving}
        >
          {pending ? dict.farmerPortal.form.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
