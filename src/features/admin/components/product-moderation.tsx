"use client";

import type { AdminPermission } from "@shared/constants/admin";
import type { Dictionary } from "@shared/i18n";
import type { ProductModeration, ProductStatus } from "@shared/schemas";
import {
  deactivateProductAction,
  setFeaturedAction,
  setProductModerationAction,
} from "../actions";
import { ActionPanel, ConfirmAction } from "./confirm-action";

const reasonOf = (form: FormData) => String(form.get("reason") ?? "").trim();

/** Moderation actions for one listing, limited to valid next states. */
export function ProductModeration({
  productId,
  moderation,
  status,
  isPublic,
  featured,
  permissions,
  t,
}: {
  productId: string;
  moderation: ProductModeration;
  status: ProductStatus;
  isPublic: boolean;
  featured: boolean;
  permissions: readonly AdminPermission[];
  t: Dictionary["admin"];
}) {
  const p = t.productDetail;
  const canModerate = permissions.includes("products.moderate");
  const canFeature = permissions.includes("products.feature");

  return (
    <ActionPanel>
      {canModerate ? (
        <div className="flex flex-wrap gap-3">
          {moderation === "pending" || moderation === "rejected" ? (
            <ConfirmAction
              t={t}
              label={p.approve}
              title={p.approve}
              body={p.approveConfirm}
              reason="optional"
              onConfirm={(f) =>
                setProductModerationAction(productId, "ok", reasonOf(f))
              }
              success={p.done.approved}
            />
          ) : null}
          {moderation === "pending" ? (
            <ConfirmAction
              t={t}
              tone="secondary"
              label={p.reject}
              title={p.reject}
              body={p.rejectConfirm}
              reason="required"
              onConfirm={(f) =>
                setProductModerationAction(productId, "rejected", reasonOf(f))
              }
              success={p.done.rejected}
            />
          ) : null}
          {moderation === "removed" ? (
            <ConfirmAction
              t={t}
              label={p.restore}
              title={p.restore}
              body={p.restoreConfirm}
              reason="optional"
              onConfirm={(f) =>
                setProductModerationAction(productId, "ok", reasonOf(f))
              }
              success={p.done.restored}
            />
          ) : (
            <ConfirmAction
              t={t}
              tone="danger"
              label={p.remove}
              title={p.remove}
              body={p.removeConfirm}
              reason="required"
              onConfirm={(f) =>
                setProductModerationAction(productId, "removed", reasonOf(f))
              }
              success={p.done.removed}
            />
          )}
          {status === "active" || status === "sold_out" ? (
            <ConfirmAction
              t={t}
              tone="secondary"
              label={p.deactivate}
              title={p.deactivate}
              body={p.deactivateConfirm}
              reason="required"
              onConfirm={(f) => deactivateProductAction(productId, reasonOf(f))}
              success={p.done.deactivated}
            />
          ) : null}
        </div>
      ) : null}

      {canFeature ? (
        featured ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={p.unfeature}
            title={p.unfeature}
            onConfirm={() => setFeaturedAction("product", productId, false)}
            success={p.done.unfeatured}
          />
        ) : isPublic ? (
          <ConfirmAction
            t={t}
            tone="secondary"
            label={p.feature}
            title={p.feature}
            onConfirm={() => setFeaturedAction("product", productId, true)}
            success={p.done.featured}
          />
        ) : (
          <p className="text-sm text-muted">{p.featureHint}</p>
        )
      ) : null}
    </ActionPanel>
  );
}
