"use client";

import type { Dictionary } from "@shared/i18n";
import {
  discardBrandingDraftAction,
  publishBrandingAction,
  restoreBrandingVersionAction,
  type AdminActionResult,
} from "../actions";
import { ConfirmAction } from "./confirm-action";

type AdminText = Dictionary["admin"];
const asResult = (p: Promise<unknown>) => p as Promise<AdminActionResult>;

/** Publish the saved draft (with an optional history note) or discard it. */
export function BrandingPublishControls({ t }: { t: AdminText }) {
  const b = t.branding.actions;
  return (
    <div className="flex flex-wrap gap-3">
      <ConfirmAction
        t={t}
        size="md"
        label={b.publish}
        title={b.publish}
        body={b.publishBody}
        reason="optional"
        reasonLabel={b.publishNote}
        onConfirm={(f) =>
          asResult(
            publishBrandingAction(
              String(f.get("reason") ?? "").trim() || undefined,
            ),
          )
        }
        success={b.published}
      />
      <ConfirmAction
        t={t}
        size="md"
        tone="secondary"
        label={b.discard}
        title={b.discard}
        body={b.discardBody}
        onConfirm={() => asResult(discardBrandingDraftAction())}
        success={b.discarded}
      />
    </div>
  );
}

/** Copy a published version into the draft. */
export function RestoreVersionButton({
  versionId,
  t,
}: {
  versionId: string;
  t: AdminText;
}) {
  const h = t.branding.history;
  return (
    <ConfirmAction
      t={t}
      tone="secondary"
      label={h.restore}
      title={h.restore}
      body={h.restoreBody}
      onConfirm={() => asResult(restoreBrandingVersionAction(versionId))}
      success={h.restored}
    />
  );
}
