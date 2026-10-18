import Link from "next/link";
import { pickLocalized } from "@shared/constants/locales";
import { formatDateTime } from "@shared/utils/date";
import { REPORT_STATUSES, REPORT_TARGET_TYPES } from "@shared/schemas";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { listReports } from "@/services/server/admin-queries";
import {
  FilterBar,
  FilterSelect,
  Pager,
  StatusBadge,
  oneOf,
  param,
  withQuery,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { fill } from "@shared/i18n/format";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

const STATUS_FILTERS = ["awaiting", ...REPORT_STATUSES] as const;

export default async function AdminReportsPage({
  searchParams,
}: PageProps<"/[locale]/admin/reports">) {
  const admin = await requireAdminPortal();
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  const t = dict.admin;
  const r = t.reports;
  const path = localeHref(locale, "/admin/reports");
  // Default view: reports still waiting for a decision.
  const status =
    param(params, "status") === "all"
      ? undefined
      : (oneOf(param(params, "status"), STATUS_FILTERS) ?? "awaiting");
  const targetType = oneOf(param(params, "type"), REPORT_TARGET_TYPES);
  const assigneeParam = oneOf(param(params, "assignee"), [
    "me",
    "unassigned",
  ] as const);
  const assignee = assigneeParam === "me" ? admin.uid : assigneeParam;
  const after = param(params, "after");
  const result = await listReports({ status, targetType, assignee, after });
  const hrefFor = (cursor?: string) =>
    withQuery(path, {
      status: status ?? "all",
      type: targetType,
      assignee: assigneeParam,
      after: cursor,
    });

  const targetHref = (item: {
    targetType: string;
    targetId: string;
    reportedUserId?: string;
  }) =>
    item.targetType === "product"
      ? localeHref(locale, `/admin/products/${item.targetId}`)
      : localeHref(
          locale,
          `/admin/users/${item.reportedUserId ?? item.targetId}`,
        );

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={r.title} description={r.intro} />
      <FilterBar action={path} clearHref={path} t={t}>
        <FilterSelect
          name="status"
          label={r.status}
          value={status ?? "all"}
          options={[
            { value: "awaiting", label: r.awaiting },
            ...REPORT_STATUSES.map((s) => ({
              value: s,
              label: dict.reportStatus[s],
            })),
            { value: "all", label: t.common.all },
          ]}
        />
        <FilterSelect
          name="type"
          label={r.type}
          value={targetType}
          allLabel={t.common.all}
          options={REPORT_TARGET_TYPES.map((s) => ({
            value: s,
            label: r.targetTypes[s],
          }))}
        />
        <FilterSelect
          name="assignee"
          label={r.assignee}
          value={assigneeParam}
          allLabel={r.anyone}
          options={[
            { value: "me", label: r.assignedToMe },
            { value: "unassigned", label: r.unassigned },
          ]}
        />
      </FilterBar>

      {result.items.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title={t.common.noResults}
          description={t.dashboard.allClear}
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label={r.title}>
          {result.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {dict.report.reasons[item.reason]}
                </h2>
                <StatusBadge
                  status={item.status}
                  label={dict.reportStatus[item.status]}
                />
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
                <div className="flex gap-2">
                  <dt className="text-muted">{r.target}:</dt>
                  <dd className="min-w-0">
                    <Badge className="me-1">
                      {r.targetTypes[item.targetType]}
                    </Badge>
                    {item.targetLabel ? (
                      <Link
                        href={targetHref(item)}
                        className="text-primary hover:underline"
                      >
                        {typeof item.targetLabel === "string"
                          ? item.targetLabel
                          : pickLocalized(item.targetLabel, locale)}
                      </Link>
                    ) : (
                      <span className="text-muted">{r.targetMissing}</span>
                    )}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted">{r.reporter}:</dt>
                  <dd>
                    <Link
                      href={localeHref(
                        locale,
                        `/admin/users/${item.reporterId}`,
                      )}
                      className="hover:underline"
                    >
                      {item.reporterName}
                    </Link>
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted">{r.received}:</dt>
                  <dd>{formatDateTime(item.createdAt, locale)}</dd>
                </div>
              </dl>
              <p className="rounded-lg bg-background p-3 text-sm whitespace-pre-line">
                {item.details}
              </p>
              {item.resolution ? (
                <p className="text-sm">
                  <span className="font-medium">{r.resolution}:</span>{" "}
                  {item.resolution}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={localeHref(locale, `/admin/reports/${item.id}`)}
                  className={buttonClasses("primary", "sm")}
                >
                  {r.open}
                </Link>
                {item.internal ? (
                  <Badge tone="warning">{r.internalRecord}</Badge>
                ) : null}
                {item.reporterRole ? (
                  <Badge>{r.reporterRoles[item.reporterRole]}</Badge>
                ) : null}
                {item.evidencePaths?.length ? (
                  <Badge>
                    {fill(dict.accountReports.evidenceCount, {
                      count: item.evidencePaths.length,
                    })}
                  </Badge>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pager
        hrefFor={hrefFor}
        after={after}
        nextCursor={result.nextCursor}
        t={t}
      />
    </div>
  );
}
