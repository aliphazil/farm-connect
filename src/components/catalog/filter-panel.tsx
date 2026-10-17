import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@shared/constants/catalog";
import {
  ATOLLS,
  atollName,
  islandName,
  type Island,
} from "@shared/constants/geography";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import type { CatalogFilters } from "@/features/catalog/filters";
import { hasActiveFilters } from "@/features/catalog/filters";
import { Button, buttonClasses } from "@/components/ui/button";
import { FilterIcon } from "@/components/ui/icons";
import { FilterDisclosure } from "./filter-disclosure";

const control =
  "block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-foreground focus:border-primary";
const labelClass = "mb-1.5 block text-sm font-medium";

/**
 * Product filters as a plain GET form: works without JavaScript and every
 * result page has a shareable URL. `action` is the page the form submits to.
 */
export function FilterPanel({
  filters,
  action,
  locale,
  dict,
  hideCategory = false,
  note,
  islands,
}: {
  filters: CatalogFilters;
  action: string;
  locale: Locale;
  dict: Dictionary;
  hideCategory?: boolean;
  /** Short note under the buttons, e.g. that filters search sample data. */
  note?: string;
  /** Island records of the active catalog source. */
  islands: readonly Island[];
}) {
  const t = dict.filters;
  const priceValue = (laari?: number) =>
    laari === undefined ? undefined : String(laari / 100);
  const islandsByAtoll = ATOLLS.map((atoll) => ({
    atoll,
    islands: islands.filter((i) => i.atollCode === atoll.code),
  })).filter((g) => g.islands.length > 0);

  return (
    <FilterDisclosure
      defaultOpen={hasActiveFilters(filters)}
      summary={
        <span className="flex items-center gap-2">
          <FilterIcon className="size-5" />
          {t.title}
        </span>
      }
    >
      <form action={action} method="get" className="flex flex-col gap-4">
        <div>
          <label htmlFor="filter-q" className={labelClass}>
            {t.q}
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={filters.q}
            maxLength={80}
            className={control}
          />
        </div>

        {hideCategory ? null : (
          <div>
            <label htmlFor="filter-category" className={labelClass}>
              {t.category}
            </label>
            <select
              id="filter-category"
              name="category"
              defaultValue={filters.category ?? ""}
              className={control}
            >
              <option value="">{t.anyCategory}</option>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {dict.categories[c]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label htmlFor="filter-atoll" className={labelClass}>
            {t.atoll}
          </label>
          <select
            id="filter-atoll"
            name="atoll"
            defaultValue={filters.atoll ?? ""}
            className={control}
          >
            <option value="">{t.anyAtoll}</option>
            {ATOLLS.map((a) => (
              <option key={a.code} value={a.code}>
                {atollName(a, locale)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-island" className={labelClass}>
            {t.island}
          </label>
          <select
            id="filter-island"
            name="island"
            defaultValue={filters.island ?? ""}
            className={control}
          >
            <option value="">{t.anyIsland}</option>
            {islandsByAtoll.map(({ atoll, islands }) => (
              <optgroup key={atoll.code} label={atollName(atoll, locale)}>
                {islands.map((i) => (
                  <option key={i.id} value={i.id}>
                    {islandName(i, locale)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={labelClass}>{t.priceRange}</legend>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-min" className="sr-only">
                {t.priceMin}
              </label>
              <input
                id="filter-min"
                name="min"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={t.priceMinShort}
                defaultValue={priceValue(filters.minPriceLaari)}
                className={control}
              />
            </div>
            <div>
              <label htmlFor="filter-max" className="sr-only">
                {t.priceMax}
              </label>
              <input
                id="filter-max"
                name="max"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder={t.priceMaxShort}
                defaultValue={priceValue(filters.maxPriceLaari)}
                className={control}
              />
            </div>
          </div>
        </fieldset>

        <div>
          <label htmlFor="filter-deliver" className={labelClass}>
            {t.deliverTo}
          </label>
          <select
            id="filter-deliver"
            name="deliver"
            defaultValue={filters.deliverTo ?? ""}
            className={control}
          >
            <option value="">{t.anyDestination}</option>
            {ATOLLS.map((a) => (
              <option key={a.code} value={a.code}>
                {atollName(a, locale)}
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className={labelClass}>{t.availability}</legend>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="available"
              value="1"
              defaultChecked={filters.availableNow}
              className="size-5 accent-primary"
            />
            {t.availableNow}
          </label>
        </fieldset>

        <div>
          <label htmlFor="filter-sort" className={labelClass}>
            {t.sort}
          </label>
          <select
            id="filter-sort"
            name="sort"
            defaultValue={filters.sort}
            className={control}
          >
            <option value="newest">{t.sortNewest}</option>
            <option value="price_asc">{t.sortPriceAsc}</option>
            <option value="price_desc">{t.sortPriceDesc}</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="submit">{t.apply}</Button>
          <Link href={action} className={buttonClasses("ghost", "md")}>
            {t.clear}
          </Link>
        </div>
        {note ? <p className="text-xs text-muted">{note}</p> : null}
      </form>
    </FilterDisclosure>
  );
}
