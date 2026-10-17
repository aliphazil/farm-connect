import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { formatDateTime } from "@shared/utils/date";
import type { HistoryEntry } from "@/services/server/admin-queries";
import { Alert } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/layout-primitives";
import { cn } from "@/lib/cn";

type AdminText = Dictionary["admin"];
type Tone = "neutral" | "success" | "warning" | "danger";

const TONES: Record<string, Tone> = {
  // account
  active: "success",
  suspended: "warning",
  blocked: "danger",
  // farm approval
  approved: "success",
  pending: "warning",
  rejected: "danger",
  // listing moderation
  ok: "success",
  removed: "danger",
  // report
  open: "warning",
  reviewing: "warning",
  resolved: "success",
  dismissed: "neutral",
};

/** Status badge: colour from the status, text from the dictionary. */
export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return <Badge tone={TONES[status] ?? "neutral"}>{label}</Badge>;
}

/** Shown on owner-only pages to moderators. */
export function NotAllowed({ t }: { t: AdminText }) {
  return <Alert tone="warning">{t.common.ownerOnly}</Alert>;
}

/**
 * Filter bar: a plain GET form, so filters live in the URL (shareable, work
 * without JavaScript). Pagination cursors are dropped when filters change.
 */
export function FilterBar({
  action,
  children,
  t,
  clearHref,
}: {
  action: string;
  children: ReactNode;
  t: AdminText;
  clearHref: string;
}) {
  return (
    <form
      action={action}
      method="get"
      role="search"
      className="mb-5 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      {children}
      <div className="flex gap-2">
        <button type="submit" className={buttonClasses("primary", "md")}>
          {t.common.apply}
        </button>
        <Link href={clearHref} className={buttonClasses("ghost", "md")}>
          {t.common.clear}
        </Link>
      </div>
    </form>
  );
}

/** A labelled native select for FilterBar. */
export function FilterSelect({
  name,
  label,
  value,
  options,
  allLabel,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  return (
    <label className="flex min-w-40 flex-col gap-1.5 text-sm font-medium">
      {label}
      <select
        name={name}
        defaultValue={value ?? ""}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
      >
        {allLabel !== undefined ? <option value="">{allLabel}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterSearch({
  name = "q",
  label,
  value,
}: {
  name?: string;
  label: string;
  value?: string;
}) {
  return (
    <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="search"
        name={name}
        defaultValue={value}
        maxLength={120}
        className="min-h-11 rounded-lg border border-border bg-surface px-3 text-base"
      />
    </label>
  );
}

/** Cursor pagination: first page + next page links. */
export function Pager({
  hrefFor,
  after,
  nextCursor,
  t,
}: {
  hrefFor: (after?: string) => string;
  after?: string;
  nextCursor: string | null;
  t: AdminText;
}) {
  if (!after && !nextCursor) return null;
  return (
    <nav
      aria-label={t.common.nextPage}
      className="mt-6 flex flex-wrap justify-between gap-3"
    >
      {after ? (
        <Link href={hrefFor()} className={buttonClasses("secondary", "md")}>
          {t.common.firstPage}
        </Link>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Link
          href={hrefFor(nextCursor)}
          className={buttonClasses("secondary", "md")}
        >
          {t.common.nextPage}
        </Link>
      ) : null}
    </nav>
  );
}

/** Builds a URL with the given query values (empty values dropped). */
export function withQuery(
  path: string,
  params: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** A dashboard figure with its definition. Null values show "—". */
export function Metric({
  label,
  value,
  help,
  badge,
  href,
}: {
  label: string;
  value: string;
  help: string;
  badge?: string;
  href?: string;
}) {
  const body = (
    <Card
      className={cn(
        "flex h-full flex-col gap-1",
        href && "transition hover:border-primary",
      )}
    >
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {label}
        {badge ? <Badge>{badge}</Badge> : null}
      </p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted">{help}</p>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-2">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Administrative history (adminLogs), newest first. */
export function HistoryList({
  entries,
  locale,
  empty,
}: {
  entries: HistoryEntry[];
  locale: Locale;
  empty: string;
}) {
  if (!entries.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ol className="flex flex-col gap-3 border-s border-border ps-4">
      {entries.map((e) => (
        <li key={e.id} className="text-sm">
          <p>
            <span className="font-mono font-medium">{e.action}</span>{" "}
            <span className="text-muted">
              · {e.actorName} · {formatDateTime(e.createdAt, locale)}
            </span>
          </p>
          {e.details && Object.keys(e.details).length ? (
            <p className="mt-0.5 break-words text-muted">
              {Object.entries(e.details)
                .map(
                  ([k, v]) =>
                    `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
                )
                .join(" · ")}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

/** First value of a search param. */
export function param(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  const v = params[key];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s.slice(0, 200) : undefined;
}

/** A value only if it's one of `allowed`. */
export function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}
