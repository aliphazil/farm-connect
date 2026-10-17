import { pickLocalized } from "@shared/constants/locales";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { listConsumerFinance } from "@/services/server/consumer";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

const VERIFY_TONE = {
  unverified: "neutral",
  verified: "success",
  rejected: "danger",
} as const;

export default async function MyInvoicesPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, { invoices, payments }] = await Promise.all([
    getLocale(),
    getDictionary(),
    listConsumerFinance(user.uid),
  ]);
  const t = dict.account.invoices;
  const money = (laari: number) => formatMVR(laari, locale);
  const verifyLabel = {
    unverified: t.unverified,
    verified: t.verified,
    rejected: t.rejected,
  } as const;
  const th = "px-3 py-2 text-start font-medium text-muted";
  const td = "px-3 py-2";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t.title} description={t.intro} />

      <section aria-labelledby="invoices">
        <h2 id="invoices" className="mb-3 text-lg font-semibold">
          {t.invoicesTitle}
        </h2>
        {invoices.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
            {t.noInvoices}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>{t.number}</th>
                  <th className={th}>{dict.account.enquiries.farm}</th>
                  <th className={th}>{t.date}</th>
                  <th className={th}>{t.total}</th>
                  <th className={th}>{t.paid}</th>
                  <th className={th}>{t.balance}</th>
                  <th className={th}>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr
                    key={i.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className={`${td} font-medium`}>{i.number}</td>
                    <td className={td}>
                      {i.farmName ? pickLocalized(i.farmName, locale) : "—"}
                    </td>
                    <td className={td}>
                      {formatDate(i.issuedAt ?? i.createdAt, locale)}
                    </td>
                    <td className={td}>{money(i.totalLaari)}</td>
                    <td className={td}>{money(i.paidLaari)}</td>
                    <td className={td}>
                      {money(Math.max(0, i.totalLaari - i.paidLaari))}
                    </td>
                    <td className={td}>
                      <Badge
                        tone={
                          i.status === "paid"
                            ? "success"
                            : i.status === "void"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {dict.invoiceStatus[i.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="payments">
        <h2 id="payments" className="mb-3 text-lg font-semibold">
          {t.paymentsTitle}
        </h2>
        {payments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
            {t.noPayments}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className={th}>{t.date}</th>
                  <th className={th}>{t.number}</th>
                  <th className={th}>{t.method}</th>
                  <th className={th}>{t.amount}</th>
                  <th className={th}>{t.status}</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className={td}>{formatDate(p.receivedAt, locale)}</td>
                    <td className={td}>{p.invoiceNumber ?? "—"}</td>
                    <td className={td}>{dict.paymentMethods[p.method]}</td>
                    <td className={td}>{money(p.amountLaari)}</td>
                    <td className={td}>
                      <Badge tone={VERIFY_TONE[p.verificationStatus]}>
                        {verifyLabel[p.verificationStatus]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
