"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { PRODUCT_UNITS, type ProductUnit } from "@shared/constants/catalog";
import {
  pickLocalized,
  type Locale,
  type LocalizedText,
} from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { computeTotals, TotalsError } from "@shared/ledger";
import { PAYMENT_METHODS, type PaymentMethod } from "@shared/schemas";
import { formatMVR, parseMVR } from "@shared/utils/money";
import { maldivesDay, maldivesDayBoundary } from "@shared/utils/date";
import { checkEvidence, uploadPaymentProof } from "@/services/client/uploads";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/ui/form-field";
import {
  cancelInvoiceAction,
  createInvoiceAction,
  createOrderAction,
  issueInvoiceAction,
  recordPaymentAction,
  recordRefundAction,
  reverseEntryAction,
  setOrderStatusAction,
  type FinanceActionResult,
} from "../actions";

type Feedback = { ok: boolean; text: string } | null;

function errorText(dict: Dictionary, res: FinanceActionResult) {
  if (res.ok) return "";
  if (res.error === "unauthorized") return dict.authErrors.sessionExpired;
  const e = dict.sales.errors;
  return res.error in e ? e[res.error as keyof typeof e] : e.failed;
}

function useAction(dict: Dictionary) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function run(
    work: () => Promise<FinanceActionResult>,
    success: string,
  ) {
    setPending(true);
    setFeedback(null);
    try {
      const res = await work();
      setFeedback({
        ok: res.ok,
        text: res.ok ? success : errorText(dict, res),
      });
      if (res.ok) router.refresh();
      return res;
    } catch (err) {
      console.error(err);
      setFeedback({ ok: false, text: dict.sales.errors.failed });
      return null;
    } finally {
      setPending(false);
    }
  }
  return { pending, feedback, setFeedback, run };
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  return feedback ? (
    <Alert tone={feedback.ok ? "success" : "error"}>{feedback.text}</Alert>
  ) : null;
}

/** A button that asks for confirmation (native dialog), with an optional reason. */
export function ConfirmButton({
  label,
  title,
  body,
  reasonLabel,
  danger,
  dict,
  onConfirm,
  success,
}: {
  label: string;
  title: string;
  body?: ReactNode;
  reasonLabel?: string;
  danger?: boolean;
  dict: Dictionary;
  onConfirm: (reason: string) => Promise<FinanceActionResult>;
  success: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const { pending, feedback, setFeedback, run } = useAction(dict);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(
      new FormData(event.currentTarget).get("reason") ?? "",
    ).trim();
    if (reasonLabel && reason.length < 3) {
      setError(dict.admin.common.reasonHint);
      return;
    }
    setError(null);
    const res = await run(() => onConfirm(reason), success);
    if (res?.ok) dialog.current?.close();
    else if (res) {
      setError(errorText(dict, res));
      setFeedback(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="sm"
        variant={danger ? "danger" : "secondary"}
        className="self-start"
        aria-haspopup="dialog"
        onClick={() => {
          setError(null);
          dialog.current?.showModal();
        }}
      >
        {label}
      </Button>
      <FeedbackLine feedback={feedback} />
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-t`}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <form onSubmit={submit} className="flex flex-col gap-4 p-5">
          <h2 id={`${id}-t`} className="text-lg font-semibold">
            {title}
          </h2>
          {body ? <p className="text-sm text-muted">{body}</p> : null}
          {reasonLabel ? (
            <TextAreaField
              id={`${id}-r`}
              name="reason"
              label={reasonLabel}
              rows={3}
              maxLength={500}
              required
            />
          ) : null}
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => dialog.current?.close()}
              disabled={pending}
            >
              {dict.common.cancel}
            </Button>
            <Button
              type="submit"
              variant={danger ? "danger" : "primary"}
              loading={pending}
              loadingLabel={dict.common.loading}
            >
              {dict.admin.common.confirm}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// New transaction
// ---------------------------------------------------------------------------

export type ProductOption = {
  id: string;
  title: LocalizedText;
  unit: ProductUnit;
  priceLaari: number;
};

type Row = {
  key: number;
  productId: string;
  title: string;
  quantity: string;
  unit: ProductUnit;
  price: string;
};

export function OrderForm({
  products,
  enquiry,
  dict,
  locale,
}: {
  products: ProductOption[];
  enquiry: {
    id: string;
    buyerName: string;
    productId?: string;
    quantity?: number;
  } | null;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.sales;
  const router = useRouter();
  const first = products.find((p) => p.id === enquiry?.productId);
  const [rows, setRows] = useState<Row[]>([
    {
      key: 0,
      productId: first?.id ?? "",
      title: "",
      quantity: String(enquiry?.quantity ?? 1),
      unit: first?.unit ?? "kg",
      price: first ? (first.priceLaari / 100).toFixed(2) : "",
    },
  ]);
  const [discount, setDiscount] = useState("0");
  const [delivery, setDelivery] = useState("0");
  const { pending, feedback, run } = useAction(dict);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const pickProduct = (key: number, id: string) => {
    const p = products.find((x) => x.id === id);
    update(
      key,
      p
        ? {
            productId: id,
            unit: p.unit,
            price: (p.priceLaari / 100).toFixed(2),
          }
        : { productId: "" },
    );
  };

  const parsed = rows.map((r) => ({
    quantity: Number(r.quantity),
    unitPriceLaari: parseMVR(r.price) ?? NaN,
  }));
  let preview: string | null = null;
  try {
    preview = formatMVR(
      computeTotals(parsed, parseMVR(discount) ?? 0, parseMVR(delivery) ?? 0)
        .totalLaari,
      locale,
    );
  } catch (e) {
    if (!(e instanceof TotalsError)) throw e;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const res = await run(
      () =>
        createOrderAction({
          enquiryId: enquiry?.id,
          buyerName: enquiry
            ? undefined
            : String(f.get("buyerName") ?? "").trim() || undefined,
          buyerPhone: enquiry
            ? undefined
            : String(f.get("buyerPhone") ?? "").trim() || undefined,
          items: rows.map((r, i) => ({
            productId: r.productId || undefined,
            title: r.productId ? undefined : r.title.trim(),
            quantity: parsed[i].quantity,
            unit: r.unit,
            unitPriceLaari: parsed[i].unitPriceLaari,
          })),
          discountLaari: parseMVR(discount) ?? 0,
          deliveryFeeLaari: parseMVR(delivery) ?? 0,
          notes: String(f.get("notes") ?? "").trim() || undefined,
        }),
      "",
    );
    if (res?.ok && res.id) router.push(`/${locale}/farmer/sales/${res.id}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">{t.buyer}</legend>
        {enquiry ? (
          <p className="text-sm">
            {t.linkedBuyer.replace("{name}", enquiry.buyerName)}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              name="buyerName"
              label={t.buyerName}
              required
              maxLength={120}
            />
            <TextField
              name="buyerPhone"
              type="tel"
              label={t.buyerPhone}
              hint={dict.auth.phoneHint}
            />
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 font-semibold">{t.items}</legend>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-end"
          >
            <div className="flex flex-col gap-2">
              <SelectField
                id={`item-${r.key}-product`}
                name={`product-${r.key}`}
                label={t.product}
                value={r.productId}
                onChange={(e) => pickProduct(r.key, e.target.value)}
                options={[
                  { value: "", label: t.otherItem },
                  ...products.map((p) => ({
                    value: p.id,
                    label: pickLocalized(p.title, locale),
                  })),
                ]}
              />
              {!r.productId ? (
                <TextField
                  id={`item-${r.key}-title`}
                  name={`title-${r.key}`}
                  label={t.itemName}
                  value={r.title}
                  onChange={(e) => update(r.key, { title: e.target.value })}
                  maxLength={100}
                  required
                />
              ) : null}
            </div>
            <TextField
              id={`item-${r.key}-qty`}
              name={`qty-${r.key}`}
              type="number"
              step="0.001"
              min="0.001"
              inputMode="decimal"
              label={t.quantity}
              value={r.quantity}
              onChange={(e) => update(r.key, { quantity: e.target.value })}
              required
            />
            <SelectField
              id={`item-${r.key}-unit`}
              name={`unit-${r.key}`}
              label={t.unit}
              value={r.unit}
              onChange={(e) =>
                update(r.key, { unit: e.target.value as ProductUnit })
              }
              options={PRODUCT_UNITS.map((u) => ({
                value: u,
                label: dict.units[u],
              }))}
            />
            <TextField
              id={`item-${r.key}-price`}
              name={`price-${r.key}`}
              inputMode="decimal"
              label={t.unitPrice}
              value={r.price}
              onChange={(e) => update(r.key, { price: e.target.value })}
              required
            />
            {rows.length > 1 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setRows((rs) => rs.filter((x) => x.key !== r.key))
                }
              >
                {t.removeItem}
              </Button>
            ) : (
              <span />
            )}
            <span className="sr-only">{i + 1}</span>
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() =>
            setRows((rs) => [
              ...rs,
              {
                key: Date.now(),
                productId: "",
                title: "",
                quantity: "1",
                unit: "kg",
                price: "",
              },
            ])
          }
        >
          {t.addItem}
        </Button>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          name="discount"
          inputMode="decimal"
          label={t.discount}
          value={discount}
          onChange={(e) => setDiscount(e.target.value)}
        />
        <TextField
          name="delivery"
          inputMode="decimal"
          label={t.deliveryFee}
          value={delivery}
          onChange={(e) => setDelivery(e.target.value)}
        />
      </div>
      <p className="text-lg font-semibold">
        {t.total}: {preview ?? "—"}
      </p>
      <TextAreaField name="notes" label={t.notes} rows={2} maxLength={1000} />
      <p className="text-sm text-muted">{t.snapshotNote}</p>
      <FeedbackLine feedback={feedback?.ok ? null : feedback} />
      <div>
        <Button
          type="submit"
          loading={pending}
          loadingLabel={dict.common.loading}
          disabled={!preview}
        >
          {t.create}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Transaction and invoice controls
// ---------------------------------------------------------------------------

export function OrderStatusControls({
  orderId,
  status,
  canCancel,
  dict,
}: {
  orderId: string;
  status: string;
  canCancel: boolean;
  dict: Dictionary;
}) {
  const t = dict.sales;
  if (status === "cancelled") return null;
  return (
    <div className="flex flex-wrap gap-3">
      {status !== "delivered" ? (
        <ConfirmButton
          label={t.markDelivered}
          title={t.markDelivered}
          body={t.markDeliveredBody}
          dict={dict}
          onConfirm={() => setOrderStatusAction(orderId, "delivered")}
          success={t.delivered}
        />
      ) : null}
      {canCancel ? (
        <ConfirmButton
          danger
          label={t.cancelOrder}
          title={t.cancelOrder}
          body={t.cancelOrderBody}
          dict={dict}
          onConfirm={() => setOrderStatusAction(orderId, "cancelled")}
          success={t.orderCancelled}
        />
      ) : null}
    </div>
  );
}

export function InvoiceCreateForm({
  orderId,
  dict,
}: {
  orderId: string;
  dict: Dictionary;
}) {
  const t = dict.sales;
  const { pending, feedback, run } = useAction(dict);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const due = String(f.get("dueAt") ?? "");
    await run(
      () =>
        createInvoiceAction({
          orderId,
          dueAt: due
            ? (maldivesDayBoundary(due, "end") ?? undefined)
            : undefined,
          paymentTerms: String(f.get("paymentTerms") ?? "").trim() || undefined,
          notes: String(f.get("notes") ?? "").trim() || undefined,
        }),
      t.invoiceCreated,
    );
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <TextField name="dueAt" type="date" label={t.dueDate} />
      <TextAreaField
        name="paymentTerms"
        label={t.paymentTerms}
        hint={t.paymentTermsHint}
        rows={2}
        maxLength={500}
      />
      <TextAreaField
        name="notes"
        label={t.invoiceNotes}
        rows={2}
        maxLength={1000}
      />
      <FeedbackLine feedback={feedback} />
      <div>
        <Button
          type="submit"
          loading={pending}
          loadingLabel={dict.common.loading}
        >
          {t.createInvoice}
        </Button>
      </div>
    </form>
  );
}

export function InvoiceControls({
  invoiceId,
  status,
  canCancel,
  dict,
}: {
  invoiceId: string;
  status: string;
  canCancel: boolean;
  dict: Dictionary;
}) {
  const t = dict.sales;
  return (
    <div className="flex flex-wrap gap-3">
      {status === "draft" ? (
        <ConfirmButton
          label={t.issue}
          title={t.issue}
          body={t.issueBody}
          dict={dict}
          onConfirm={() => issueInvoiceAction(invoiceId)}
          success={t.issued}
        />
      ) : null}
      {canCancel ? (
        <ConfirmButton
          danger
          label={t.cancelInvoice}
          title={t.cancelInvoice}
          body={t.cancelInvoiceBody}
          reasonLabel={dict.admin.common.reason}
          dict={dict}
          onConfirm={(reason) => cancelInvoiceAction(invoiceId, reason)}
          success={t.invoiceCancelled}
        />
      ) : null}
    </div>
  );
}

/** Record a payment (or a refund) against an issued invoice. */
export function PaymentForm({
  invoiceId,
  kind,
  maxLaari,
  dict,
  locale,
}: {
  invoiceId: string;
  kind: "payment" | "refund";
  maxLaari: number;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.sales;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { pending, feedback, run } = useAction(dict);
  const today = maldivesDay(new Date());

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const f = new FormData(formEl);
    const amount = parseMVR(String(f.get("amount") ?? ""));
    if (!amount || amount <= 0) return setError(t.errors.invalid_input);
    if (amount > maxLaari)
      return setError(
        kind === "payment"
          ? `${t.errors.overpayment} (${formatMVR(maxLaari, locale)})`
          : `${t.errors.refund_exceeds_paid} (${formatMVR(maxLaari, locale)})`,
      );
    setError(null);
    let proofPath: string | undefined;
    if (file) {
      if (checkEvidence(file)) return setError(t.errors.proof_invalid);
      try {
        proofPath = await uploadPaymentProof(file);
      } catch {
        return setError(t.errors.proof_invalid);
      }
    }
    const day = String(f.get("date") ?? today);
    const input = {
      amountLaari: amount,
      method: String(f.get("method")) as PaymentMethod,
      receivedAt: maldivesDayBoundary(day, "start") ?? new Date(),
      reference: String(f.get("reference") ?? "").trim() || undefined,
      notes: String(f.get("notes") ?? "").trim() || undefined,
      proofPath,
    };
    const res = await run(
      () =>
        kind === "payment"
          ? recordPaymentAction(invoiceId, input)
          : recordRefundAction(invoiceId, input),
      kind === "payment" ? t.paymentRecorded : t.refundRecorded,
    );
    if (res?.ok) {
      formEl.reset();
      setFile(null);
      setOpen(false);
    }
  }

  if (!open)
    return (
      <div className="flex flex-col gap-2">
        <Button
          size="sm"
          variant={kind === "payment" ? "primary" : "secondary"}
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {kind === "payment" ? t.recordPayment : t.recordRefund}
        </Button>
        <FeedbackLine feedback={feedback} />
      </div>
    );

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-border p-4"
    >
      <h3 className="font-semibold">
        {kind === "payment" ? t.recordPayment : t.recordRefund}
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          id={`${id}-amount`}
          name="amount"
          inputMode="decimal"
          label={t.amount}
          defaultValue={(maxLaari / 100).toFixed(2)}
          required
        />
        <SelectField
          id={`${id}-method`}
          name="method"
          label={t.method}
          defaultValue="cash"
          options={PAYMENT_METHODS.map((m) => ({
            value: m,
            label: dict.paymentMethods[m],
          }))}
        />
        <TextField
          id={`${id}-date`}
          name="date"
          type="date"
          label={t.paymentDate}
          defaultValue={today}
          max={today}
          required
        />
      </div>
      <TextField
        id={`${id}-ref`}
        name="reference"
        label={t.reference}
        maxLength={120}
      />
      {kind === "payment" ? (
        <div className="flex flex-col gap-1.5 text-sm">
          <label htmlFor={`${id}-proof`} className="font-medium">
            {t.proof}
          </label>
          <input
            id={`${id}-proof`}
            name="proof"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            aria-describedby={`${id}-proof-hint`}
          />
          <span id={`${id}-proof-hint`} className="text-muted">
            {t.proofHint}
          </span>
        </div>
      ) : null}
      <TextField
        id={`${id}-notes`}
        name="notes"
        label={t.paymentNotes}
        maxLength={500}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <FeedbackLine feedback={feedback?.ok ? null : feedback} />
      <div className="flex gap-2">
        <Button
          type="submit"
          loading={pending}
          loadingLabel={dict.common.loading}
        >
          {kind === "payment" ? t.recordPayment : t.recordRefund}
        </Button>
        <Button
          variant="ghost"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          {dict.common.cancel}
        </Button>
      </div>
    </form>
  );
}

export function ReverseButton({
  paymentId,
  dict,
}: {
  paymentId: string;
  dict: Dictionary;
}) {
  const t = dict.sales;
  return (
    <ConfirmButton
      danger
      label={t.reverse}
      title={t.reverse}
      body={t.reverseBody}
      reasonLabel={dict.admin.common.reason}
      dict={dict}
      onConfirm={(reason) => reverseEntryAction(paymentId, reason)}
      success={t.reversedDone}
    />
  );
}
