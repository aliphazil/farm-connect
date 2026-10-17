import Link from "next/link";
import { pickLocalized } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { PRODUCT_MODERATION, PRODUCT_STATUSES } from "@shared/schemas";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { listProductsAdmin } from "@/services/server/admin-queries";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  Pager,
  StatusBadge,
  oneOf,
  param,
  withQuery,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminProductsPage({
  searchParams,
}: PageProps<"/[locale]/admin/products">) {
  await requireAdminPortal();
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  const t = dict.admin;
  const p = t.products;
  const path = localeHref(locale, "/admin/products");
  const filters = {
    q: param(params, "q"),
    moderation: oneOf(param(params, "moderation"), PRODUCT_MODERATION),
    status: oneOf(param(params, "status"), PRODUCT_STATUSES),
    reported: param(params, "reported") === "1",
    farmerId: param(params, "farmer"),
    after: param(params, "after"),
  };
  const result = await listProductsAdmin(filters);
  const hrefFor = (after?: string) =>
    withQuery(path, {
      q: filters.q,
      moderation: filters.moderation,
      status: filters.status,
      reported: filters.reported ? "1" : undefined,
      farmer: filters.farmerId,
      after,
    });

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={p.title} description={p.intro} />
      <FilterBar action={path} clearHref={path} t={t}>
        <FilterSearch label={p.searchLabel} value={filters.q} />
        <FilterSelect
          name="moderation"
          label={p.moderation}
          value={filters.moderation}
          allLabel={t.common.all}
          options={PRODUCT_MODERATION.map((m) => ({
            value: m,
            label: p.moderationStates[m],
          }))}
        />
        <FilterSelect
          name="status"
          label={p.status}
          value={filters.status}
          allLabel={t.common.all}
          options={PRODUCT_STATUSES.map((s) => ({
            value: s,
            label: dict.productStatus[s],
          }))}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="reported"
            value="1"
            defaultChecked={filters.reported}
            className="size-5 accent-primary"
          />
          {p.reported}
        </label>
        {filters.farmerId ? (
          <input type="hidden" name="farmer" value={filters.farmerId} />
        ) : null}
      </FilterBar>

      {result.items.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={t.common.noResults}
          description={t.common.noResultsBody}
        />
      ) : (
        <ul className="flex flex-col gap-2" aria-label={p.title}>
          <li
            aria-hidden="true"
            className="hidden grid-cols-[2.5fr_1.5fr_1fr_2fr_1fr] gap-4 px-4 text-xs font-semibold tracking-wide text-muted uppercase md:grid"
          >
            <span>{p.listing}</span>
            <span>{p.farm}</span>
            <span>{p.price}</span>
            <span>{p.moderation}</span>
            <span>{p.created}</span>
          </li>
          {result.items.map((item) => (
            <li
              key={item.id}
              className="grid gap-2 rounded-xl border border-border bg-surface p-4 md:grid-cols-[2.5fr_1.5fr_1fr_2fr_1fr] md:items-center md:gap-4"
            >
              <div className="min-w-0">
                <Link
                  href={localeHref(locale, `/admin/products/${item.id}`)}
                  className="font-semibold text-primary hover:underline"
                >
                  {pickLocalized(item.title, locale)}
                </Link>
                <p className="text-sm text-muted">
                  {dict.categories[item.category]}
                </p>
              </div>
              <div className="truncate text-sm">
                {item.farmName ? pickLocalized(item.farmName, locale) : "—"}
              </div>
              <div className="text-sm">
                {formatMVR(item.priceLaari, locale)} / {dict.units[item.unit]}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <StatusBadge
                  status={item.moderation}
                  label={p.moderationStates[item.moderation]}
                />
                <Badge>{dict.productStatus[item.status]}</Badge>
                <Badge tone={item.isPublic ? "success" : "neutral"}>
                  {item.isPublic ? p.live : p.notLive}
                </Badge>
                {item.featured ? (
                  <Badge tone="success">{p.featured}</Badge>
                ) : null}
                {item.openReports ? (
                  <Badge tone="danger">
                    {fill(p.openReports, { count: item.openReports })}
                  </Badge>
                ) : null}
              </div>
              <div className="text-sm text-muted">
                <span className="md:sr-only">{p.created}: </span>
                {formatDate(item.createdAt, locale)}
              </div>
            </li>
          ))}
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
