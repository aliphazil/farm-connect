import { LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { getAdminStats } from "@/services/server/admin-queries";
import { parseRange, RANGE_PRESETS } from "@/features/admin/range";
import { LiftSuspensions } from "@/features/admin/components/settings-actions";
import { FilterBar, FilterSelect, Metric } from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminDashboard({
  searchParams,
}: PageProps<"/[locale]/admin">) {
  const user = await requireAdminPortal();
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  const t = dict.admin;
  const d = t.dashboard;
  const m = d.metrics;
  const range = parseRange(params, new Date());
  const stats = await getAdminStats({ from: range.from, to: range.to });

  const n = (v: number | null) =>
    v === null ? "—" : v.toLocaleString("en-US");
  const money = (v: number | null) => (v === null ? "—" : formatMVR(v, locale));
  const countAndTotal = (c: number | null, total: number | null) =>
    c === null || total === null
      ? "—"
      : fill(d.countAndTotal, { count: n(c), amount: money(total) });
  const inactive =
    stats.products.total === null || stats.products.active === null
      ? null
      : stats.products.total - stats.products.active;
  const anyMissing = JSON.stringify(stats).includes("null");
  const admin = (path: string) => localeHref(locale, path);
  const canModerate =
    LEVEL_PERMISSIONS[user.adminLevel ?? "moderator"].includes(
      "users.moderate",
    );

  const section = (title: string, children: React.ReactNode) => (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );

  const waiting = [
    stats.farmersPending ? (
      <ButtonLink
        key="f"
        href={admin("/admin/farmers?approval=pending")}
        size="sm"
      >
        {fill(d.reviewFarms, { count: stats.farmersPending })}
      </ButtonLink>
    ) : null,
    stats.products.pendingReview ? (
      <ButtonLink
        key="p"
        href={admin("/admin/products?moderation=pending")}
        size="sm"
      >
        {fill(d.reviewListings, { count: stats.products.pendingReview })}
      </ButtonLink>
    ) : null,
    stats.reportsAwaiting ? (
      <ButtonLink key="r" href={admin("/admin/reports")} size="sm">
        {fill(d.reviewReports, { count: stats.reportsAwaiting })}
      </ButtonLink>
    ) : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={d.title}
        description={`${d.intro} ${fill(t.common.yourLevel, {
          level: t.common.levels[user.adminLevel ?? "moderator"],
        })}`}
      />

      <section aria-labelledby="attention" className="flex flex-col gap-3">
        <h2 id="attention" className="font-semibold">
          {d.attention}
        </h2>
        {waiting.length ? (
          <div className="flex flex-wrap gap-2">{waiting}</div>
        ) : (
          <p className="text-sm text-muted">{d.allClear}</p>
        )}
        {stats.accounts.suspensionsEnded ? (
          <Alert tone="info">
            <p>
              {fill(d.expiredSuspensions, {
                count: stats.accounts.suspensionsEnded,
              })}
            </p>
            {canModerate ? (
              <div className="mt-2">
                <LiftSuspensions t={t} />
              </div>
            ) : null}
          </Alert>
        ) : null}
      </section>

      <FilterBar action={admin("/admin")} clearHref={admin("/admin")} t={t}>
        <FilterSelect
          name="range"
          label={d.range}
          value={range.preset}
          options={RANGE_PRESETS.map((p) => ({ value: p, label: d.ranges[p] }))}
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {d.from}
          <input
            type="date"
            name="from"
            defaultValue={range.fromDay}
            className="min-h-11 rounded-lg border border-border bg-surface px-3"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {d.to}
          <input
            type="date"
            name="to"
            defaultValue={range.toDay}
            className="min-h-11 rounded-lg border border-border bg-surface px-3"
          />
        </label>
      </FilterBar>
      <p className="-mt-3 text-sm text-muted">
        {fill(d.periodNote, {
          from: range.from ? formatDate(range.from, locale) : "—",
          to: formatDate(range.to, locale),
        })}
      </p>
      {anyMissing ? <Alert tone="warning">{t.common.loadFailed}</Alert> : null}

      {section(
        d.sections.people,
        <>
          <Metric
            label={m.usersTotal.label}
            value={n(stats.users.total)}
            help={m.usersTotal.help}
          />
          <Metric
            label={m.farmers.label}
            value={n(stats.users.farmers)}
            help={m.farmers.help}
            href={admin("/admin/farmers")}
          />
          <Metric
            label={m.consumers.label}
            value={n(stats.users.consumers)}
            help={m.consumers.help}
            href={admin("/admin/buyers")}
          />
          <Metric
            label={m.newUsers.label}
            value={n(stats.users.newInRange)}
            help={m.newUsers.help}
            badge={d.inPeriod}
          />
          <Metric
            label={m.farmersPending.label}
            value={n(stats.farmersPending)}
            help={m.farmersPending.help}
            href={admin("/admin/farmers?approval=pending")}
          />
        </>,
      )}

      {section(
        d.sections.marketplace,
        <>
          <Metric
            label={m.productsActive.label}
            value={n(stats.products.active)}
            help={m.productsActive.help}
            href={admin("/admin/products")}
          />
          <Metric
            label={m.productsInactive.label}
            value={n(inactive)}
            help={m.productsInactive.help}
          />
          <Metric
            label={m.productsPending.label}
            value={n(stats.products.pendingReview)}
            help={m.productsPending.help}
            href={admin("/admin/products?moderation=pending")}
          />
        </>,
      )}

      {section(
        d.sections.activity,
        <>
          <Metric
            label={m.visits.label}
            value={n(stats.visits)}
            help={m.visits.help}
            badge={d.inPeriod}
          />
          <Metric
            label={m.productViews.label}
            value={n(stats.productViews)}
            help={m.productViews.help}
            badge={d.inPeriod}
          />
          <Metric
            label={m.enquiries.label}
            value={n(stats.enquiries)}
            help={m.enquiries.help}
            badge={d.inPeriod}
          />
          <Metric
            label={m.contactClicks.label}
            value={n(stats.contactClicks)}
            help={m.contactClicks.help}
            badge={d.inPeriod}
          />
        </>,
      )}

      {section(
        d.sections.money,
        <>
          <Metric
            label={m.invoices.label}
            value={countAndTotal(
              stats.invoices.count,
              stats.invoices.totalLaari,
            )}
            help={m.invoices.help}
            badge={d.inPeriod}
          />
          <Metric
            label={m.payments.label}
            value={countAndTotal(
              stats.payments.count,
              stats.payments.totalLaari,
            )}
            help={m.payments.help}
            badge={d.inPeriod}
          />
          <Metric
            label={m.paymentsVerified.label}
            value={money(stats.payments.verifiedLaari)}
            help={m.paymentsVerified.help}
            badge={d.inPeriod}
          />
        </>,
      )}

      {section(
        d.sections.safety,
        <>
          <Metric
            label={m.reportsAwaiting.label}
            value={n(stats.reportsAwaiting)}
            help={m.reportsAwaiting.help}
            href={admin("/admin/reports")}
          />
          <Metric
            label={m.suspended.label}
            value={n(stats.accounts.suspended)}
            help={m.suspended.help}
            href={admin("/admin/farmers?status=suspended")}
          />
          <Metric
            label={m.blocked.label}
            value={n(stats.accounts.blocked)}
            help={m.blocked.help}
            href={admin("/admin/farmers?status=blocked")}
          />
        </>,
      )}
    </div>
  );
}
