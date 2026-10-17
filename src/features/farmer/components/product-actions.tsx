"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { ProductStatus } from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import {
  deleteProduct,
  setProductQuantity,
  setProductStatus,
} from "@/services/client/products";
import { Button, buttonClasses } from "@/components/ui/button";
import { useFarmerAction } from "./use-farmer-action";

/** Status, quantity and delete controls for one of the farmer's products. */
export function ProductActions({
  productId,
  title,
  status,
  quantity,
  locked,
  dict,
  locale,
}: {
  productId: string;
  title: string;
  status: ProductStatus;
  quantity: number;
  /** Removed by an admin: no farmer changes allowed. */
  locked: boolean;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.farmerPortal.products;
  const { run, pending, error } = useFarmerAction(
    dict.authErrors.sessionExpired,
  );
  const [editingQty, setEditingQty] = useState(false);

  const setStatus = (next: ProductStatus) =>
    run(() => setProductStatus(productId, next), t.actionFailed);

  async function saveQuantity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(new FormData(event.currentTarget).get("quantity"));
    if (!Number.isFinite(value) || value < 0) return;
    if (await run(() => setProductQuantity(productId, value), t.actionFailed))
      setEditingQty(false);
  }

  const small = buttonClasses("secondary", "sm");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Link
          href={localeHref(locale, `/farmer/products/${productId}/preview`)}
          className={small}
        >
          {t.preview}
        </Link>
        {locked ? null : (
          <>
            <Link
              href={localeHref(locale, `/farmer/products/${productId}/edit`)}
              className={small}
            >
              {t.edit}
            </Link>
            {status === "active" ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setStatus("paused")}
                >
                  {t.deactivate}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setStatus("sold_out")}
                >
                  {t.markSoldOut}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => setStatus("active")}
              >
                {t.publish}
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              disabled={pending}
              onClick={() => setEditingQty((v) => !v)}
              aria-expanded={editingQty}
            >
              {t.updateQuantity}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-danger"
              disabled={pending}
              onClick={() => {
                if (window.confirm(t.confirmDelete))
                  run(() => deleteProduct(productId), t.actionFailed);
              }}
            >
              {t.delete}
            </Button>
          </>
        )}
      </div>
      {editingQty ? (
        <form onSubmit={saveQuantity} className="flex items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            {fill(t.newQuantity, { product: title })}
            <input
              name="quantity"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              defaultValue={quantity}
              className="w-32 rounded-lg border border-border bg-surface px-3 py-2"
              autoFocus
            />
          </label>
          <Button
            type="submit"
            size="sm"
            loading={pending}
            loadingLabel={t.saving}
          >
            {t.save}
          </Button>
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
