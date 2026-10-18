import { getAtoll, atollName } from "@shared/constants/geography";
import { pickLocalized } from "@shared/constants/locales";
import { ANALYTICS_MAX_DAYS } from "@shared/schemas";
import { fill } from "@shared/i18n/format";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import { getSiteAnalytics } from "@/services/server/analytics";
import { ANALYTICS_PRESETS, parseRange } from "@/features/admin/range";
import { Metric, NotAllowed } from "@/components/admin/admin-ui";
import {
  AnalyticsRangeForm,
  MetricGrid,
  RankTable,
  TrendChart,
  formatCount as n,
} from "@/components/analytics/analytics-ui";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminAnalyticsPage({
  searchParams,
}: PageProps<"/[locale]/admin/analytics">) {
  const { allowed } = await requireAdminPermission("analytics.view");
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  if (!allowed) return <NotAllowed t={dict.admin} />;

  const t = dict.analytics;
  const m = t.metrics;
  const range = parseRange(params, new Date(), {
    presets: ANALYTICS_PRESETS,
    maxDays: ANALYTICS_MAX_DAYS,
  });
  const a = await getSiteAnalytics({ from: range.from!, to: range.to });
  const money = (v: number | undefined) =>
    v === undefined ? "—" : formatMVR(v, locale);
  const missing = [
    a.enquiries,
    a.registrations,
    a.activeFarmers,
    a.reports,
    a.invoices,
    a.payments,
  ].some((v) => v === null);
  const visitors = a.uniqueVisitors.exact
    ? n(a.uniqueVisitors.value)
    : fill(t.estimate, { value: n(a.uniqueVisitors.value) });
  const series = (key: keyof (typeof a.series)[number]) =>
    a.series.map((p) => ({ day: p.day, value: Number(p[key]) }));
  const reasonLabel = (id: string) =>
    (dict.report.reasons as Record<string, string>)[id] ?? id;
  const typeLabel = (id: string) =>
    (dict.admin.enforcement.types as Record<string, string>)[id] ?? id;
  const categoryLabel = (id: string) =>
    (dict.categories as Record<string, string>)[id] ?? id;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.intro} />
      <AnalyticsRangeForm
        action={localeHref(locale, "/admin/analytics")}
        range={range}
        dict={dict}
        locale={locale}
      />
      {missing ? <Alert tone="warning">{t.loadFailed}</Alert> : null}

      <MetricGrid title={t.sections.traffic}>
        <Metric
          label={m.visitors.label}
          value={visitors}
          help={a.uniqueVisitors.exact ? m.visitors.help : m.visitors.helpRange}
        />
        <Metric
          label={m.sessions.label}
          value={n(a.totals.sessions)}
          help={m.sessions.help}
        />
        <Metric
          label={m.pageViews.label}
          value={n(a.totals.pageViews)}
          help={m.pageViews.help}
        />
        <Metric
          label={m.productViews.label}
          value={n(a.totals.productViews)}
          help={m.productViews.help}
        />
        <Metric
          label={m.farmerViews.label}
          value={n(a.totals.farmerViews)}
          help={m.farmerViews.help}
        />
        <Metric
          label={m.searches.label}
          value={n(a.totals.searches)}
          help={fill(m.searches.help, {
            none: n(a.totals.searchesNoResults),
          })}
        />
        <Metric
          label={m.filterUses.label}
          value={n(a.totals.filterUses)}
          help={m.filterUses.help}
        />
      </MetricGrid>

      <MetricGrid title={t.sections.marketplace}>
        <Metric
          label={m.contactClicks.label}
          value={n(a.totals.contactClicks)}
          help={`${fill(m.byChannel, {
            call: n(a.totals.contactCall),
            whatsapp: n(a.totals.contactWhatsapp),
            viber: n(a.totals.contactViber),
          })} ${m.contactClicks.help}`}
        />
        <Metric
          label={m.enquiries.label}
          value={n(a.enquiries)}
          help={m.enquiries.help}
        />
        <Metric
          label={m.activeFarmers.label}
          value={n(a.activeFarmers?.withListings)}
          help={m.activeFarmers.help}
        />
        <Metric
          label={m.farmersWithEnquiries.label}
          value={n(a.activeFarmers?.withEnquiries)}
          help={m.farmersWithEnquiries.help}
        />
        <Metric
          label={m.newFarmers.label}
          value={n(a.registrations?.farmers)}
          help={m.newFarmers.help}
        />
        <Metric
          label={m.newConsumers.label}
          value={n(a.registrations?.consumers)}
          help={m.newConsumers.help}
        />
      </MetricGrid>

      <MetricGrid title={t.sections.money}>
        <Metric
          label={m.invoices.label}
          value={
            a.invoices
              ? fill(t.countAndTotal, {
                  count: n(a.invoices.count),
                  amount: money(a.invoices.totalLaari),
                })
              : "—"
          }
          help={fill(m.invoices.help, {
            cancelled: n(a.invoices?.cancelled),
          })}
        />
        <Metric
          label={m.payments.label}
          value={
            a.payments
              ? fill(t.countAndTotal, {
                  count: n(a.payments.count),
                  amount: money(a.payments.totalLaari),
                })
              : "—"
          }
          help={m.payments.help}
        />
        <Metric
          label={m.paymentsVerified.label}
          value={money(a.payments?.verifiedLaari)}
          help={fill(m.paymentsVerified.help, {
            pending: money(a.payments?.pendingLaari),
            rejected: money(a.payments?.rejectedLaari),
          })}
        />
        <Metric
          label={m.refunds.label}
          value={money(a.payments?.refundsLaari)}
          help={fill(m.refunds.help, {
            reversals: money(a.payments?.reversalsLaari),
          })}
        />
      </MetricGrid>

      <MetricGrid title={t.sections.safety}>
        <Metric
          label={m.reportsOpened.label}
          value={n(a.reports?.opened)}
          help={m.reportsOpened.help}
        />
        <Metric
          label={m.reportsClosed.label}
          value={n(a.reports?.closed)}
          help={m.reportsClosed.help}
        />
        <Metric
          label={m.reportsOpenNow.label}
          value={n(a.reports?.openNow)}
          help={m.reportsOpenNow.help}
          href={localeHref(locale, "/admin/reports")}
        />
      </MetricGrid>

      <section aria-label={t.sections.trends} className="flex flex-col gap-3">
        <h2 className="font-semibold">{t.sections.trends}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <TrendChart
            title={t.trends.visitors}
            points={series("visitors")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.pageViews}
            points={series("pageViews")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.productViews}
            points={series("productViews")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.contactClicks}
            points={series("contactClicks")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.enquiries}
            points={series("enquiries")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.farmers}
            points={series("farmers")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.consumers}
            points={series("consumers")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.reportsOpened}
            points={series("reportsOpened")}
            locale={locale}
            t={t}
          />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <RankTable
          caption={t.sections.products}
          columns={[
            t.table.product,
            t.table.views,
            t.table.clicks,
            t.table.enquiries,
          ]}
          rows={a.topProducts.map((p) => ({
            key: p.id,
            cells: [
              p.name ? pickLocalized(p.name, locale) : t.table.deleted,
              n(p.views),
              n(p.clicks),
              n(p.enquiries),
            ],
          }))}
          empty={t.table.none}
        />
        <RankTable
          caption={t.sections.categories}
          columns={[t.table.category, t.table.views, t.table.filterUses]}
          rows={a.categories.map((c) => ({
            key: c.id,
            cells: [categoryLabel(c.id), n(c.views), n(c.filterUses)],
          }))}
          empty={t.table.none}
        />
        <RankTable
          caption={t.sections.islands}
          columns={[t.table.island, t.table.views, t.table.filterUses]}
          rows={a.islands.map((i) => ({
            key: i.id,
            cells: [
              i.name ? pickLocalized(i.name, locale) : i.id,
              n(i.views),
              n(i.filterUses),
            ],
          }))}
          empty={t.table.none}
        />
        <RankTable
          caption={t.sections.atolls}
          columns={[t.table.atoll, t.table.filterUses]}
          rows={a.atollFilters.map((x) => {
            const atoll = getAtoll(x.id);
            return {
              key: x.id,
              cells: [atoll ? atollName(atoll, locale) : x.id, n(x.count)],
            };
          })}
          empty={t.table.none}
        />
        <RankTable
          caption={t.sections.reasons}
          columns={[t.table.reason, t.table.count]}
          rows={(a.reports?.byReason ?? []).map((r) => ({
            key: r.id,
            cells: [reasonLabel(r.id), n(r.count)],
          }))}
          empty={t.table.none}
        />
        <RankTable
          caption={t.sections.enforcement}
          columns={[t.table.type, t.table.count]}
          rows={(a.reports?.enforcement ?? []).map((r) => ({
            key: r.id,
            cells: [typeLabel(r.id), n(r.count)],
          }))}
          empty={t.table.none}
        />
      </section>

      <section aria-labelledby="definitions" className="flex flex-col gap-2">
        <h2 id="definitions" className="font-semibold">
          {t.sections.definitions}
        </h2>
        <ul className="list-disc ps-5 text-sm text-muted">
          {t.definitions.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
