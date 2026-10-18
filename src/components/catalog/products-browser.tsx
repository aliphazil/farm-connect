import Link from "next/link";
import type { ReactNode } from "react";
import type { ProductCategory } from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import {
  filtersToSearchParams,
  hasActiveFilters,
  parseCatalogFilters,
  type CatalogFilters,
} from "@/features/catalog/filters";
import {
  catalogNow,
  getCatalogIslands,
  isSampleCatalog,
  searchListings,
  searchListingsLive,
} from "@/features/catalog/queries";
import type { ListingCard } from "@/features/catalog/types";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronIcon } from "@/components/ui/icons";
import { Pagination } from "@/components/ui/pagination";
import { FilterPanel } from "./filter-panel";
import { ProductGrid, ProductGridSkeleton } from "./product-grid";
import { TrackCatalog } from "./track-catalog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Filter sidebar + results + paging. Reads search params, so it must be
 * rendered inside <Suspense> (see ProductsBrowserFallback).
 *
 * Live catalog (CATALOG_SOURCE=firestore): one Firestore query per page,
 * paged with a cursor ("More results"). Sample catalog: in-memory pages.
 */
export async function ProductsBrowser({
  searchParams,
  basePath,
  locale,
  dict,
  fixedCategory,
}: {
  searchParams: SearchParams;
  /** Locale-prefixed path the filter form submits to. */
  basePath: string;
  locale: Locale;
  dict: Dictionary;
  fixedCategory?: ProductCategory;
}) {
  const [islands, params] = await Promise.all([
    getCatalogIslands(),
    searchParams,
  ]);
  const parsed = parseCatalogFilters(params, islands);
  const filters: CatalogFilters = fixedCategory
    ? { ...parsed, category: fixedCategory }
    : parsed;
  const filtered = hasActiveFilters(
    fixedCategory ? { ...filters, category: undefined } : filters,
  );
  const href = (overrides: Partial<CatalogFilters>, after?: string) => {
    const qs = filtersToSearchParams(
      { ...filters, category: fixedCategory ? undefined : filters.category },
      overrides,
    );
    if (after) qs.set("after", after);
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  let items: ListingCard[];
  let countLabel: string;
  let pager: ReactNode = null;
  let firstPage = true;

  if (isSampleCatalog) {
    const result = await searchListings(filters);
    items = result.items;
    countLabel =
      result.total === 1
        ? dict.products.resultsOne
        : fill(dict.products.resultsMany, { count: result.total });
    pager = (
      <Pagination
        page={result.page}
        pageCount={result.pageCount}
        hrefFor={(page) => href({ page })}
        labels={{
          nav: dict.pagination.label,
          previous: dict.pagination.previous,
          next: dict.pagination.next,
          status: fill(dict.pagination.page, {
            page: result.page,
            pages: result.pageCount,
          }),
        }}
      />
    );
  } else {
    const after =
      typeof params.after === "string" ? params.after.slice(0, 128) : undefined;
    firstPage = !after;
    const result = await searchListingsLive(filters, after);
    items = result.items;
    countLabel =
      result.total === null
        ? fill(dict.products.showing, { count: items.length })
        : result.total === 1
          ? dict.products.resultsOne
          : fill(dict.products.resultsMany, { count: result.total });
    pager =
      after || result.nextCursor ? (
        <nav
          aria-label={dict.pagination.label}
          className="mt-8 flex flex-wrap items-center justify-between gap-3"
        >
          {after ? (
            <Link
              href={href({ page: 1 })}
              className={buttonClasses("secondary", "md")}
            >
              {dict.pagination.firstPage}
            </Link>
          ) : (
            <span />
          )}
          {result.nextCursor ? (
            <Link
              href={href({ page: 1 }, result.nextCursor)}
              className={buttonClasses("secondary", "md")}
            >
              {dict.pagination.moreResults}
              <ChevronIcon />
            </Link>
          ) : null}
        </nav>
      ) : null;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr] lg:items-start">
      <aside className="lg:sticky lg:top-4">
        <FilterPanel
          filters={filters}
          action={basePath}
          locale={locale}
          dict={dict}
          hideCategory={Boolean(fixedCategory)}
          islands={islands}
          note={
            isSampleCatalog ? dict.sample.filtersNote : dict.products.searchNote
          }
        />
      </aside>
      <div className="min-w-0">
        {!isSampleCatalog && firstPage ? (
          <TrackCatalog
            q={filters.q}
            noResults={items.length === 0}
            category={filters.category}
            atoll={filters.atoll}
            island={filters.island}
          />
        ) : null}
        <p role="status" className="mb-4 text-sm font-medium text-muted">
          {countLabel}
        </p>
        {items.length === 0 && firstPage ? (
          <EmptyState
            icon="🔍"
            title={
              filtered ? dict.products.noResultsTitle : dict.products.emptyTitle
            }
            description={
              filtered ? dict.products.noResultsBody : dict.products.emptyBody
            }
            action={
              filtered ? (
                <ButtonLink href={basePath} variant="secondary">
                  {dict.filters.clear}
                </ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <>
            {items.length > 0 ? (
              <ProductGrid
                listings={items}
                locale={locale}
                dict={dict}
                now={await catalogNow()}
                columns={3}
                priorityCount={3}
              />
            ) : (
              <p className="text-muted">{dict.products.noMoreResults}</p>
            )}
            {pager}
          </>
        )}
      </div>
    </div>
  );
}

export function ProductsBrowserFallback({ dict }: { dict: Dictionary }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[17rem_1fr]">
      <div className="h-12 rounded-xl border border-border bg-surface lg:h-144" />
      <ProductGridSkeleton
        count={6}
        columns={3}
        label={dict.states.loadingProducts}
      />
    </div>
  );
}
