import Link from "next/link";
import { placeText } from "@shared/constants/geography";
import { pickLocalized, type Locale } from "@shared/constants/locales";
import { ACCOUNT_STATUSES } from "@shared/constants/roles";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { formatMvPhone } from "@shared/utils/phone";
import { FARMER_APPROVAL_STATUSES } from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import { getIslandMap, toPlace } from "@/services/server/farmer";
import { listUsers } from "@/services/server/admin-queries";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  Pager,
  StatusBadge,
  oneOf,
  param,
  withQuery,
} from "./admin-ui";

/** Searchable, filterable, paged list of farmer or buyer accounts. */
export async function UsersList({
  role,
  params,
  locale,
  dict,
}: {
  role: "farmer" | "consumer";
  params: Record<string, string | string[] | undefined>;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin;
  const u = t.users;
  const path = localeHref(
    locale,
    role === "farmer" ? "/admin/farmers" : "/admin/buyers",
  );
  const filters = {
    q: param(params, "q"),
    status: oneOf(param(params, "status"), ACCOUNT_STATUSES),
    approval:
      role === "farmer"
        ? oneOf(param(params, "approval"), FARMER_APPROVAL_STATUSES)
        : undefined,
    after: param(params, "after"),
  };
  const [result, islands] = await Promise.all([
    listUsers({ role, ...filters }),
    getIslandMap(),
  ]);
  const hrefFor = (after?: string) =>
    withQuery(path, {
      q: filters.q,
      status: filters.status,
      approval: filters.approval,
      after,
    });

  return (
    <div className="flex flex-col gap-2">
      <PageHeader
        title={role === "farmer" ? u.farmersTitle : u.buyersTitle}
        description={u.intro}
      />
      <FilterBar action={path} clearHref={path} t={t}>
        <FilterSearch label={u.searchLabel} value={filters.q} />
        <FilterSelect
          name="status"
          label={u.status}
          value={filters.status}
          allLabel={t.common.all}
          options={ACCOUNT_STATUSES.map((s) => ({
            value: s,
            label: u.statuses[s],
          }))}
        />
        {role === "farmer" ? (
          <FilterSelect
            name="approval"
            label={u.approval}
            value={filters.approval}
            allLabel={t.common.all}
            options={FARMER_APPROVAL_STATUSES.map((s) => ({
              value: s,
              label: u.approvals[s],
            }))}
          />
        ) : null}
      </FilterBar>

      {result.scanLimited ? (
        <Alert tone="info" className="mb-3">
          {fill(t.common.scanLimited, { count: 500 })}
        </Alert>
      ) : null}

      {result.items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={t.common.noResults}
          description={t.common.noResultsBody}
        />
      ) : (
        <ul
          className="flex flex-col gap-2"
          aria-label={role === "farmer" ? u.farmersTitle : u.buyersTitle}
        >
          <li
            aria-hidden="true"
            className="hidden grid-cols-[2fr_2fr_1.5fr_1fr_1fr] gap-4 px-4 text-xs font-semibold tracking-wide text-muted uppercase md:grid"
          >
            <span>{u.name}</span>
            <span>{u.contact}</span>
            <span>{u.location}</span>
            <span>{u.status}</span>
            <span>{u.joined}</span>
          </li>
          {result.items.map((row) => {
            const place = row.farm
              ? placeText(
                  toPlace(islands, row.farm.atollCode, row.farm.islandId),
                  locale,
                )
              : null;
            return (
              <li
                key={row.uid}
                className="grid gap-2 rounded-xl border border-border bg-surface p-4 md:grid-cols-[2fr_2fr_1.5fr_1fr_1fr] md:items-center md:gap-4"
              >
                <div className="min-w-0">
                  <Link
                    href={localeHref(locale, `/admin/users/${row.uid}`)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {row.displayName}
                  </Link>
                  {row.farm ? (
                    <p className="truncate text-sm text-muted">
                      {pickLocalized(row.farm.farmName, locale)}
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0 text-sm">
                  <p className="truncate">{row.email ?? "—"}</p>
                  <p className="text-muted">
                    {row.phone ? formatMvPhone(row.phone) : ""}
                  </p>
                </div>
                <div className="text-sm text-muted">{place ?? "—"}</div>
                <div className="flex flex-wrap gap-1.5">
                  <StatusBadge
                    status={row.status}
                    label={u.statuses[row.status]}
                  />
                  {row.farm ? (
                    <StatusBadge
                      status={row.farm.approvalStatus}
                      label={u.approvals[row.farm.approvalStatus]}
                    />
                  ) : null}
                  {row.restrictions.length ? (
                    <Badge tone="warning">{u.restricted}</Badge>
                  ) : null}
                  {row.status === "suspended" && row.suspendedUntil ? (
                    <span className="text-xs text-muted">
                      {fill(u.until, {
                        date: formatDate(row.suspendedUntil, locale),
                      })}
                    </span>
                  ) : null}
                </div>
                <div className="text-sm text-muted">
                  <span className="md:sr-only">{u.joined}: </span>
                  {formatDate(row.createdAt, locale)}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Pager
        hrefFor={hrefFor}
        after={filters.after}
        nextCursor={result.nextCursor}
        t={t}
      />
    </div>
  );
}
