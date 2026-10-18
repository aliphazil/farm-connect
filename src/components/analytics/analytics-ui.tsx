import type { ReactNode } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatDate, maldivesDayBoundary } from "@shared/utils/date";
import { ANALYTICS_PRESETS, type ParsedRange } from "@/features/admin/range";
import { FilterBar, FilterSelect } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/layout-primitives";

type T = Dictionary["analytics"];

export const formatCount = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : v.toLocaleString("en-US");

const dayLabel = (day: string, locale: Locale) =>
  formatDate(maldivesDayBoundary(day, "start")!, locale);

/** Period picker: today, 7 days, 30 days or custom dates (Maldives time). */
export function AnalyticsRangeForm({
  action,
  range,
  dict,
  locale,
}: {
  action: string;
  range: ParsedRange;
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.analytics;
  const input =
    "min-h-11 rounded-lg border border-border bg-surface px-3 text-base";
  return (
    <>
      <FilterBar action={action} clearHref={action} t={dict.admin}>
        <FilterSelect
          name="range"
          label={t.range}
          value={range.preset}
          options={ANALYTICS_PRESETS.map((p) => ({
            value: p,
            label: t.ranges[p],
          }))}
        />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.from}
          <input
            type="date"
            name="from"
            defaultValue={range.fromDay}
            className={input}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t.to}
          <input
            type="date"
            name="to"
            defaultValue={range.toDay}
            className={input}
          />
        </label>
      </FilterBar>
      <p className="-mt-3 text-sm text-muted" data-testid="analytics-period">
        {fill(t.period, {
          from: range.from ? formatDate(range.from, locale) : "—",
          to: formatDate(range.to, locale),
        })}
      </p>
      {range.clamped ? (
        <p className="text-sm text-warning">{t.clamped}</p>
      ) : null}
    </>
  );
}

/**
 * A daily bar chart with its numbers available as a table (screen readers
 * and anyone who wants exact values).
 */
export function TrendChart({
  title,
  points,
  locale,
  t,
}: {
  title: string;
  points: { day: string; value: number }[];
  locale: Locale;
  t: T;
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <Card className="flex flex-col gap-3">
      <figure className="flex flex-col gap-3">
        <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="font-semibold">{title}</span>
          <span className="text-sm text-muted">
            {fill(t.chart.total, { count: formatCount(total) })}
          </span>
        </figcaption>
        <div
          aria-hidden="true"
          className="flex h-28 items-end gap-px border-b border-border"
        >
          {points.map((p) => (
            <div
              key={p.day}
              title={`${dayLabel(p.day, locale)}: ${formatCount(p.value)}`}
              className="min-w-0 flex-1 rounded-t-sm bg-primary/80"
              style={{
                height: `${p.value ? Math.max(4, (p.value / max) * 100) : 0}%`,
              }}
            />
          ))}
        </div>
        {points.length > 1 ? (
          <div
            aria-hidden="true"
            className="flex justify-between text-xs text-muted"
          >
            <span>{dayLabel(points[0].day, locale)}</span>
            <span>{dayLabel(points[points.length - 1].day, locale)}</span>
          </div>
        ) : null}
      </figure>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">
          {t.chart.showTable}
        </summary>
        <table className="mt-2 w-full text-start">
          <thead>
            <tr className="text-muted">
              <th scope="col" className="py-1 text-start font-medium">
                {t.chart.day}
              </th>
              <th scope="col" className="py-1 text-end font-medium">
                {title}
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.day} className="border-t border-border">
                <td className="py-1">{dayLabel(p.day, locale)}</td>
                <td className="py-1 text-end tabular-nums">
                  {formatCount(p.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}

/** A ranked table (top products, categories, islands…). */
export function RankTable({
  caption,
  columns,
  rows,
  empty,
}: {
  caption: string;
  columns: string[];
  rows: { key: string; cells: ReactNode[] }[];
  empty: string;
}) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-2 text-start font-semibold">{caption}</caption>
        <thead>
          <tr className="text-muted">
            {columns.map((c, i) => (
              <th
                key={c}
                scope="col"
                className={`py-1.5 font-medium ${i === 0 ? "text-start" : "text-end"}`}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-3 text-muted">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                {r.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={`py-1.5 ${i === 0 ? "text-start" : "text-end tabular-nums"}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Card>
  );
}

export function MetricGrid({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="font-semibold">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}
