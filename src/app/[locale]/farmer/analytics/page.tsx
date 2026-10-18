import { pickLocalized } from "@shared/constants/locales";
import { ANALYTICS_MAX_DAYS } from "@shared/schemas";
import { fill } from "@shared/i18n/format";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerAnalytics } from "@/services/server/analytics";
import { ANALYTICS_PRESETS, parseRange } from "@/features/admin/range";
import { Metric } from "@/components/admin/admin-ui";
import {
  AnalyticsRangeForm,
  MetricGrid,
  RankTable,
  TrendChart,
  formatCount as n,
} from "@/components/analytics/analytics-ui";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/layout-primitives";

/** A farmer's own listings only: every figure is filtered by the session uid. */
export default async function FarmerAnalyticsPage({
  searchParams,
}: PageProps<"/[locale]/farmer/analytics">) {
  const user = await requireFarmerPortal();
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  const t = dict.analytics;
  const m = t.metrics;
  const range = parseRange(params, new Date(), {
    presets: ANALYTICS_PRESETS,
    maxDays: ANALYTICS_MAX_DAYS,
  });
  const a = await getFarmerAnalytics(user.uid, {
    from: range.from!,
    to: range.to,
  });
  const series = (
    key: "productViews" | "profileViews" | "contactClicks" | "enquiries",
  ) => a.series.map((p) => ({ day: p.day, value: p[key] }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.farmerIntro} />
      <AnalyticsRangeForm
        action={localeHref(locale, "/farmer/analytics")}
        range={range}
        dict={dict}
        locale={locale}
      />
      {a.totals.enquiries === null ? (
        <Alert tone="warning">{t.loadFailed}</Alert>
      ) : null}

      <MetricGrid title={t.sections.yourListings}>
        <Metric
          label={m.productViews.label}
          value={n(a.totals.productViews)}
          help={m.productViews.help}
        />
        <Metric
          label={m.farmerViews.label}
          value={n(a.totals.profileViews)}
          help={m.farmerViews.help}
        />
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
          value={n(a.totals.enquiries)}
          help={m.enquiries.help}
          href={localeHref(locale, "/farmer/enquiries")}
        />
      </MetricGrid>

      <RankTable
        caption={t.sections.popularProducts}
        columns={[
          t.table.product,
          t.table.views,
          t.table.clicks,
          t.table.enquiries,
        ]}
        rows={a.products.map((p) => ({
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

      <section aria-label={t.sections.trends} className="flex flex-col gap-3">
        <h2 className="font-semibold">{t.sections.trends}</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <TrendChart
            title={t.trends.productViews}
            points={series("productViews")}
            locale={locale}
            t={t}
          />
          <TrendChart
            title={t.trends.profileViews}
            points={series("profileViews")}
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
        </div>
      </section>

      <section aria-labelledby="definitions" className="flex flex-col gap-2">
        <h2 id="definitions" className="font-semibold">
          {t.sections.definitions}
        </h2>
        <ul className="list-disc ps-5 text-sm text-muted">
          {t.farmerDefinitions.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
