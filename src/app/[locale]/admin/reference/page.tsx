import { ATOLLS } from "@shared/constants/geography";
import { fill } from "@shared/i18n/format";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import {
  listCategoriesAdmin,
  listIslandsAdmin,
  listUnitsAdmin,
} from "@/services/server/admin-queries";
import {
  IslandCreateForm,
  IslandEditForm,
  ReferenceItemForm,
} from "@/features/admin/components/reference-forms";
import {
  FilterBar,
  FilterSearch,
  FilterSelect,
  NotAllowed,
  StatusBadge,
  param,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout-primitives";

const ISLANDS_SHOWN = 100;

export default async function AdminReferencePage({
  searchParams,
}: PageProps<"/[locale]/admin/reference">) {
  const { allowed } = await requireAdminPermission("reference.manage");
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  const t = dict.admin;
  const r = t.reference;
  if (!allowed)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={r.title} description={r.intro} />
        <NotAllowed t={t} />
      </div>
    );

  const atollFilter = param(params, "atoll");
  const q = param(params, "q")?.toLowerCase();
  const [categories, units, islands] = await Promise.all([
    listCategoriesAdmin(),
    listUnitsAdmin(),
    listIslandsAdmin(),
  ]);
  const counts = new Map<string, number>();
  for (const i of islands)
    counts.set(i.atollCode, (counts.get(i.atollCode) ?? 0) + 1);
  const shown = islands.filter(
    (i) =>
      (!atollFilter || i.atollCode === atollFilter) &&
      (!q ||
        i.nameEn.toLowerCase().includes(q) ||
        (i.nameDv ?? "").includes(q)),
  );
  const path = localeHref(locale, "/admin/reference");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={r.title} description={r.intro} />

      <section aria-labelledby="categories" className="flex flex-col gap-3">
        <h2 id="categories" className="text-lg font-semibold">
          {r.categories}
        </h2>
        <p className="text-sm text-muted">{r.idsFixed}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {categories.map((c) => (
            <ReferenceItemForm key={c.id} kind="category" {...c} t={t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="units" className="flex flex-col gap-3">
        <h2 id="units" className="text-lg font-semibold">
          {r.units}
        </h2>
        <div className="grid gap-3 lg:grid-cols-2">
          {units.map((u) => (
            <ReferenceItemForm key={u.id} kind="unit" {...u} t={t} />
          ))}
        </div>
      </section>

      <section aria-labelledby="atolls" className="flex flex-col gap-3">
        <h2 id="atolls" className="text-lg font-semibold">
          {r.atolls}
        </h2>
        <p className="text-sm text-muted">{r.atollsFixed}</p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ATOLLS.map((a) => (
            <li
              key={a.code}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
            >
              <span>
                <span className="font-mono">{a.code}</span> · {a.abbr} —{" "}
                {a.nameEn}{" "}
                <span lang="dv" dir="rtl">
                  {a.nameDv}
                </span>
              </span>
              <span className="text-muted">
                {fill(r.islandCount, { count: counts.get(a.code) ?? 0 })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="islands" className="flex flex-col gap-3">
        <h2 id="islands" className="text-lg font-semibold">
          {r.islands}
        </h2>
        <p className="text-sm text-muted">{r.islandsIntro}</p>
        <IslandCreateForm t={t} />
        <FilterBar
          action={`${path}#islands`}
          clearHref={`${path}#islands`}
          t={t}
        >
          <FilterSelect
            name="atoll"
            label={r.filterAtoll}
            value={atollFilter}
            allLabel={t.common.all}
            options={ATOLLS.map((a) => ({
              value: a.code,
              label: `${a.abbr} — ${a.nameEn}`,
            }))}
          />
          <FilterSearch label={r.searchIslands} value={param(params, "q")} />
        </FilterBar>
        {islands.length === 0 ? (
          <EmptyState icon="🏝️" title={r.noIslands} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={t.common.noResults}
            description={t.common.noResultsBody}
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.slice(0, ISLANDS_SHOWN).map((island) => (
              <li
                key={island.id}
                className="rounded-xl border border-border bg-surface"
              >
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 p-3">
                    <span className="font-medium">{island.nameEn}</span>
                    {island.nameDv ? (
                      <span lang="dv" dir="rtl" className="text-muted">
                        {island.nameDv}
                      </span>
                    ) : null}
                    <span className="font-mono text-xs text-muted">
                      {island.id}
                    </span>
                    {island.active ? null : (
                      <StatusBadge status="dismissed" label={r.deactivated} />
                    )}
                    <span className="ms-auto text-sm text-primary">
                      {r.edit}
                    </span>
                  </summary>
                  <div className="border-t border-border p-3">
                    <IslandEditForm island={island} t={t} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
        {shown.length > ISLANDS_SHOWN ? (
          <p className="text-sm text-muted">
            {fill(r.islandCount, { count: shown.length })} —{" "}
            {t.common.noResultsBody}
          </p>
        ) : null}
      </section>
    </div>
  );
}
