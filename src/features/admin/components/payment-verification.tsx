"use client";

import type { Dictionary } from "@shared/i18n";
import { reverseLedgerEntryAction, verifyPaymentAction } from "../actions";
import { ActionPanel, ConfirmAction } from "./confirm-action";

const reasonOf = (f: FormData) => String(f.get("reason") ?? "").trim();

/** Verify (with evidence), reject, or reverse a seller-recorded payment. */
export function PaymentVerification({
  paymentId,
  hasEvidence,
  t,
}: {
  paymentId: string;
  hasEvidence: boolean;
  t: Dictionary["admin"];
}) {
  const p = t.payments;
  return (
    <ActionPanel>
      <div className="flex flex-wrap gap-3">
        {hasEvidence ? (
          <ConfirmAction
            t={t}
            label={p.verify}
            title={p.verify}
            body={p.verifyBody}
            reason="optional"
            onConfirm={(f) =>
              verifyPaymentAction(
                paymentId,
                "verified",
                reasonOf(f) || undefined,
              )
            }
            success={p.verified}
          />
        ) : (
          <p className="text-sm text-muted">{p.noEvidence}</p>
        )}
        <ConfirmAction
          t={t}
          tone="secondary"
          label={p.reject}
          title={p.reject}
          body={p.rejectBody}
          reason="required"
          onConfirm={(f) =>
            verifyPaymentAction(paymentId, "rejected", reasonOf(f))
          }
          success={p.rejected}
        />
        <ConfirmAction
          t={t}
          tone="danger"
          label={p.reverse}
          title={p.reverse}
          body={p.reverseBody}
          reason="required"
          onConfirm={(f) => reverseLedgerEntryAction(paymentId, reasonOf(f))}
          success={p.reversed}
        />
      </div>
    </ActionPanel>
  );
}
