"use client";

import { useState, type FormEvent } from "react";
import {
  DELIVERY_METHODS,
  type DeliveryMethod,
} from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatMVR, parseMVR } from "@shared/utils/money";
import { saveMyFarmerProfile } from "@/services/client/account";
import {
  createDeliveryArea,
  deleteDeliveryArea,
  updateDeliveryArea,
} from "@/services/client/products";
import { locationLabels } from "@/components/forms/labels";
import { LocationPicker } from "@/components/forms/location-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Badge } from "@/components/ui/layout-primitives";
import { useFarmerAction } from "./use-farmer-action";

export type AreaRow = {
  id: string;
  label: string;
  atollCode: string;
  islandId?: string;
  method: DeliveryMethod;
  feeLaari?: number;
  minOrderLaari?: number;
  notes?: string;
  active: boolean;
};

export function DeliveryManager({
  areas,
  pickupAvailable,
  dict,
  locale,
}: {
  areas: AreaRow[];
  pickupAvailable: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.farmerPortal.delivery;
  const { run, pending, error, setError } = useFarmerAction(
    dict.authErrors.sessionExpired,
  );
  const [formKey, setFormKey] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [saved, setSaved] = useState(false);

  async function addArea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (n: string) => String(form.get(n) ?? "").trim();
    const atollCode = text("areaAtoll");
    const islandId = text("areaIsland") || undefined;
    const method = text("method");
    const fee = text("fee") ? parseMVR(text("fee")) : undefined;
    const minOrder = text("minOrder") ? parseMVR(text("minOrder")) : undefined;

    const errs: Record<string, string> = {};
    if (!atollCode) errs.area = dict.validation.required;
    if (!method) errs.method = dict.validation.required;
    if (fee === null) errs.fee = dict.validation.invalid_amount;
    if (minOrder === null) errs.minOrder = dict.validation.invalid_amount;
    setErrors(errs);
    setSaved(false);
    if (Object.keys(errs).length) return;
    if (
      areas.some(
        (a) =>
          a.atollCode === atollCode && (a.islandId ?? "") === (islandId ?? ""),
      )
    ) {
      setError(t.duplicate);
      return;
    }
    const ok = await run(
      () =>
        createDeliveryArea({
          atollCode: atollCode as never,
          islandId,
          method: method as DeliveryMethod,
          feeLaari: fee ?? undefined,
          minOrderLaari: minOrder ?? undefined,
          notes: text("notes") || undefined,
          active: true,
        }),
      dict.farmerPortal.products.actionFailed,
    );
    if (ok) {
      setFormKey((k) => k + 1);
      setSaved(true);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section
        aria-labelledby="pickup-heading"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="pickup-heading" className="font-semibold">
          {t.pickupTitle}
        </h2>
        <label className="mt-2 flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            defaultChecked={pickupAvailable}
            disabled={pending}
            onChange={(e) => {
              const value = e.target.checked;
              run(
                () => saveMyFarmerProfile({ pickupAvailable: value }),
                dict.farmerPortal.products.actionFailed,
              );
            }}
            className="size-5 accent-primary"
          />
          {t.pickupLabel}
        </label>
      </section>

      <section aria-labelledby="areas-heading">
        <h2 id="areas-heading" className="text-lg font-semibold">
          {t.areasTitle}
        </h2>
        {error ? (
          <Alert tone="error" className="mt-3">
            {error}
          </Alert>
        ) : null}
        {saved ? (
          <Alert tone="success" className="mt-3">
            {t.saved}
          </Alert>
        ) : null}

        {areas.length === 0 ? (
          <p className="mt-3 text-muted">{t.empty}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {areas.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {a.label}
                    <Badge tone={a.active ? "success" : "neutral"}>
                      {a.active ? t.active : t.inactive}
                    </Badge>
                  </p>
                  <p className="text-sm text-muted">
                    {dict.deliveryMethods[a.method]} ·{" "}
                    {a.feeLaari !== undefined
                      ? fill(t.feeValue, { fee: formatMVR(a.feeLaari, locale) })
                      : t.noFee}
                    {a.minOrderLaari !== undefined
                      ? ` · ${fill(t.minValue, { amount: formatMVR(a.minOrderLaari, locale) })}`
                      : ""}
                  </p>
                  {a.notes ? (
                    <p className="text-sm text-muted">{a.notes}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => updateDeliveryArea(a.id, { active: !a.active }),
                        dict.farmerPortal.products.actionFailed,
                      )
                    }
                  >
                    {a.active ? t.deactivate : t.activate}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => deleteDeliveryArea(a.id),
                        dict.farmerPortal.products.actionFailed,
                      )
                    }
                  >
                    {t.remove}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form
          key={formKey}
          onSubmit={addArea}
          noValidate
          className="mt-6 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <h3 className="font-semibold">{t.add}</h3>
          <LocationPicker
            name="area"
            locale={locale}
            labels={locationLabels(dict)}
            required
            allowWholeAtoll
            error={errors.area}
          />
          <SelectField
            name="method"
            label={t.method}
            placeholder={t.chooseMethod}
            required
            requiredLabel={dict.common.required}
            error={errors.method}
            options={DELIVERY_METHODS.map((m) => ({
              value: m,
              label: dict.deliveryMethods[m],
            }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              name="fee"
              label={t.fee}
              hint={t.feeHint}
              inputMode="decimal"
              error={errors.fee}
            />
            <TextField
              name="minOrder"
              label={t.minOrder}
              inputMode="decimal"
              error={errors.minOrder}
            />
          </div>
          <TextField
            name="notes"
            label={t.notes}
            hint={t.notesHint}
            maxLength={300}
          />
          <div>
            <Button
              type="submit"
              loading={pending}
              loadingLabel={dict.farmerPortal.products.saving}
            >
              {t.save}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
