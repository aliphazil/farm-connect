"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { parseMVR } from "@shared/utils/money";
import {
  productInputSchema,
  type DeliveryDestination,
  type Product,
  type ProductInput,
} from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import {
  createProduct,
  newProductId,
  updateProduct,
} from "@/services/client/products";
import {
  deleteStoredFile,
  shrinkImage,
  uploadProductImage,
} from "@/services/client/uploads";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form-field";
import { authErrorKey } from "@/features/auth/errors";
import { refreshCatalogAction } from "../actions";
import { ImageManager, type ImageItem } from "./image-manager";

export type DeliveryOption = {
  key: string;
  label: string;
  destination: DeliveryDestination;
};

type Errors = Partial<Record<string, string>>;

const TZ = "+05:00"; // dates are entered in Maldives time

function toDateInput(date?: Date): string {
  if (!date) return "";
  return new Date(date.getTime() + 5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function fromDateInput(value: string): Date | undefined {
  return value ? new Date(`${value}T00:00:00${TZ}`) : undefined;
}

const destinationKey = (d: DeliveryDestination) =>
  `${d.atollCode}:${d.islandId ?? ""}`;

/**
 * Add/edit product. Validates with the shared schema in the browser; Security
 * Rules validate again on write. New photos upload on save under this
 * product's id; photos removed while editing are deleted after saving.
 */
export function ProductForm({
  dict,
  locale,
  product,
  deliveryOptions,
  inactive = { categories: [], units: [] },
}: {
  dict: Dictionary;
  locale: Locale;
  /** Present when editing. */
  product?: Product;
  deliveryOptions: DeliveryOption[];
  /** Categories/units an admin switched off (still shown if already chosen). */
  inactive?: { categories: readonly string[]; units: readonly string[] };
}) {
  const t = dict.farmerPortal.form;
  const categories = PRODUCT_CATEGORIES.filter(
    (c) => !inactive.categories.includes(c) || c === product?.category,
  );
  const units = PRODUCT_UNITS.filter(
    (u) => !inactive.units.includes(u) || u === product?.unit,
  );
  const router = useRouter();
  const [productId] = useState(() => product?.id ?? newProductId());
  const [images, setImages] = useState<ImageItem[]>(
    () =>
      product?.imagePaths.map(
        (path) => ({ kind: "stored", path }) as ImageItem,
      ) ?? [],
  );
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "uploading" | "saving">("idle");
  const [intent, setIntent] = useState<"publish" | "draft">("publish");
  const selected = new Set(
    product
      ? product.deliveryDestinations.map(destinationKey)
      : deliveryOptions.map((o) => o.key),
  );

  function read(form: FormData): {
    input?: Omit<ProductInput, "imagePaths">;
    errors: Errors;
  } {
    const text = (n: string) => String(form.get(n) ?? "").trim();
    const errs: Errors = {};
    const price = parseMVR(text("price"));
    if (price === null || price <= 0)
      errs.price = dict.validation.invalid_amount;
    const quantity = Number(text("quantity"));
    const minOrder = text("minOrder") ? Number(text("minOrder")) : undefined;
    const description =
      text("descriptionEn") || text("descriptionDv")
        ? { en: text("descriptionEn"), dv: text("descriptionDv") || undefined }
        : undefined;
    const destinations = deliveryOptions
      .filter((o) => form.get(`deliver-${o.key}`) === "on")
      .map((o) => o.destination);

    const candidate = {
      title: { en: text("titleEn"), dv: text("titleDv") || undefined },
      description,
      category: text("category"),
      unit: text("unit"),
      priceLaari: price ?? 0,
      quantityAvailable: text("quantity") === "" ? Number.NaN : quantity,
      minOrderQuantity: minOrder,
      deliveryDestinations: destinations,
      harvestDate: fromDateInput(text("harvestDate")),
      availableFrom: fromDateInput(text("availableFrom")),
      pickupAvailable: form.get("pickup") === "on",
      status: product?.status ?? "draft",
    };
    const result = productInputSchema
      .omit({ imagePaths: true })
      .safeParse(candidate);
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        const key =
          field === "priceLaari"
            ? "price"
            : field === "quantityAvailable"
              ? "quantity"
              : field === "minOrderQuantity"
                ? "minOrder"
                : field;
        errs[key] ??=
          key === "price"
            ? dict.validation.invalid_amount
            : dict.validation.required;
      }
    }
    if (Object.keys(errs).length) return { errors: errs };
    return { input: result.data!, errors: {} };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Which button was pressed: "Save and publish" or "Save as draft".
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const publish = submitter?.value === "publish";
    setIntent(publish ? "publish" : "draft");
    const { input, errors: errs } = read(new FormData(event.currentTarget));
    setErrors(errs);
    setFormError(null);
    if (!input) {
      setFormError(t.fixErrors);
      return;
    }
    try {
      setPhase("uploading");
      const paths: string[] = [];
      for (const item of images) {
        paths.push(
          item.kind === "stored"
            ? item.path
            : await uploadProductImage(productId, await shrinkImage(item.file)),
        );
      }
      setPhase("saving");
      if (product) {
        await updateProduct(productId, { ...input, imagePaths: paths });
        const removed = product.imagePaths.filter((p) => !paths.includes(p));
        await Promise.allSettled(removed.map(deleteStoredFile));
      } else {
        await createProduct(productId, {
          ...input,
          imagePaths: paths,
          status: publish ? "active" : "draft",
        });
      }
      await refreshCatalogAction().catch(() => undefined);
      router.push(localeHref(locale, "/farmer/products?saved=1"));
      router.refresh();
    } catch (err) {
      console.error(err);
      setFormError(
        authErrorKey(err) === "sessionExpired"
          ? dict.authErrors.sessionExpired
          : t.saveFailed,
      );
      setPhase("idle");
    }
  }

  const busy = phase !== "idle";
  const busyLabel = phase === "uploading" ? t.uploading : t.saving;
  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex max-w-2xl flex-col gap-5"
    >
      {formError ? <Alert tone="error">{formError}</Alert> : null}

      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm text-muted">{t.nameHint}</legend>
        <TextField
          name="titleEn"
          label={t.titleEn}
          defaultValue={product?.title.en}
          maxLength={100}
          error={errors.title}
        />
        <TextField
          name="titleDv"
          label={t.titleDv}
          defaultValue={product?.title.dv}
          maxLength={100}
          lang="dv"
          dir="rtl"
        />
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField
          name="category"
          label={t.category}
          placeholder={t.chooseCategory}
          defaultValue={product?.category ?? ""}
          required
          requiredLabel={dict.common.required}
          error={errors.category}
          options={categories.map((c) => ({
            value: c,
            label: dict.categories[c],
          }))}
        />
        <SelectField
          name="unit"
          label={t.unit}
          defaultValue={
            product?.unit ?? (units.includes("kg") ? "kg" : units[0])
          }
          error={errors.unit}
          options={units.map((u) => ({
            value: u,
            label: dict.units[u],
          }))}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          name="price"
          label={t.price}
          hint={t.priceHint}
          inputMode="decimal"
          defaultValue={product ? (product.priceLaari / 100).toFixed(2) : ""}
          required
          requiredLabel={dict.common.required}
          error={errors.price}
        />
        <TextField
          name="quantity"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t.quantity}
          defaultValue={product?.quantityAvailable}
          required
          requiredLabel={dict.common.required}
          error={errors.quantity}
        />
        <TextField
          name="minOrder"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          label={t.minOrder}
          defaultValue={product?.minOrderQuantity}
          error={errors.minOrder}
        />
      </div>

      <TextAreaField
        name="descriptionEn"
        label={t.descriptionEn}
        defaultValue={product?.description?.en}
        maxLength={2000}
      />
      <TextAreaField
        name="descriptionDv"
        label={t.descriptionDv}
        defaultValue={product?.description?.dv}
        maxLength={2000}
        lang="dv"
        dir="rtl"
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="harvestDate"
          type="date"
          label={t.harvestDate}
          defaultValue={toDateInput(product?.harvestDate)}
        />
        <TextField
          name="availableFrom"
          type="date"
          label={t.availableFrom}
          hint={t.availableFromHint}
          defaultValue={toDateInput(product?.availableFrom)}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">{t.deliveryTitle}</legend>
        <p className="text-sm text-muted">{t.deliveryHint}</p>
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            name="pickup"
            defaultChecked={product?.pickupAvailable ?? false}
            className="size-5 accent-primary"
          />
          {t.pickup}
        </label>
        {deliveryOptions.length === 0 ? (
          <p className="text-sm text-muted">
            {t.noDeliveryAreas}{" "}
            <Link
              href={localeHref(locale, "/farmer/delivery")}
              className="text-primary underline"
            >
              {t.manageDelivery}
            </Link>
          </p>
        ) : (
          deliveryOptions.map((o) => (
            <label key={o.key} className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                name={`deliver-${o.key}`}
                defaultChecked={selected.has(o.key)}
                className="size-5 accent-primary"
              />
              {o.label}
            </label>
          ))
        )}
      </fieldset>

      <ImageManager items={images} onChange={setImages} dict={dict} />

      <div className="flex flex-col gap-2 border-t border-border pt-5 sm:flex-row">
        {product ? (
          <Button type="submit" loading={busy} loadingLabel={busyLabel}>
            {busy ? busyLabel : t.saveChanges}
          </Button>
        ) : (
          <>
            <Button
              type="submit"
              name="intent"
              value="publish"
              loading={busy && intent === "publish"}
              loadingLabel={busyLabel}
              disabled={busy}
            >
              {busy && intent === "publish" ? busyLabel : t.publish}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="draft"
              variant="secondary"
              loading={busy && intent === "draft"}
              loadingLabel={busyLabel}
              disabled={busy}
            >
              {busy && intent === "draft" ? busyLabel : t.saveDraft}
            </Button>
          </>
        )}
        <Link
          href={localeHref(locale, "/farmer/products")}
          className="inline-flex min-h-11 items-center px-4 text-primary underline-offset-4 hover:underline"
        >
          {t.backToProducts}
        </Link>
      </div>
    </form>
  );
}
