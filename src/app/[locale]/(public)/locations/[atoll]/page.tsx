import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ATOLLS,
  atollName,
  getAtoll,
  islandName,
} from "@shared/constants/geography";
import { fill } from "@shared/i18n/format";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { parseCatalogFilters } from "@/features/catalog/filters";
import {
  catalogNow,
  getAtollSummaries,
  isSampleCatalog,
  searchListings,
} from "@/features/catalog/queries";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PinIcon } from "@/components/ui/icons";
import { Container, PageHeader } from "@/components/ui/layout-primitives";
import { Section } from "@/components/ui/section";

export async function generateStaticParams() {
  return ATOLLS.map((a) => ({ atoll: a.code.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/locations/[atoll]">): Promise<Metadata> {
  const [{ atoll: code }, locale] = await Promise.all([params, getLocale()]);
  const atoll = getAtoll(code.toUpperCase());
  return atoll ? { title: atollName(atoll, locale) } : {};
}

export default async function AtollPage({
  params,
}: PageProps<"/[locale]/locations/[atoll]">) {
  const { atoll: code } = await params;
  const atoll = getAtoll(code.toUpperCase());
  if (!atoll) notFound();

  const [locale, dict, summaries, products] = await Promise.all([
    getLocale(),
    getDictionary(),
    getAtollSummaries(),
    searchListings(parseCatalogFilters({ atoll: atoll.code })),
  ]);
  const summary = summaries.find((s) => s.code === atoll.code)!;
  const name = atollName(atoll, locale);
  // Islands from the catalog's island records, those with farms first.
  const islands = [...summary.islands].sort(
    (a, b) => b.farmCount - a.farmCount,
  );
  const productsPath = (query: string) =>
    `${localeHref(locale, "/products")}?${query}`;

  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          {
            label: dict.locations.title,
            href: localeHref(locale, "/locations"),
          },
          { label: name },
        ]}
      />
      <PageHeader
        title={name}
        description={`${fill(dict.locations.farmsCount, { count: summary.farmCount })} · ${fill(dict.locations.productsCount, { count: summary.productCount })}`}
      />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}

      <section aria-labelledby="islands-heading">
        <h2 id="islands-heading" className="text-xl font-bold">
          {dict.locations.islandsTitle}
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted">
          {dict.locations.islandsNote}
        </p>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {islands.map((island) => {
            return (
              <li key={island.id}>
                <Link
                  href={productsPath(`atoll=${atoll.code}&island=${island.id}`)}
                  className="flex h-full items-center gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary hover:bg-primary-soft"
                >
                  <PinIcon className="size-5 shrink-0 text-primary" />
                  <span>
                    <span className="block font-semibold">
                      {islandName(island, locale)}
                    </span>
                    <span className="block text-sm text-muted">
                      {island.farmCount > 0
                        ? fill(dict.locations.productsCount, {
                            count: island.productCount,
                          })
                        : dict.locations.noFarms}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <Section
        id="atoll-products"
        title={fill(dict.locations.productsTitle, { atoll: name })}
        action={
          products.total > 0
            ? {
                href: productsPath(`atoll=${atoll.code}`),
                label: dict.common.viewAll,
              }
            : undefined
        }
      >
        {products.total === 0 ? (
          <EmptyState
            icon="🏝️"
            title={dict.locations.noFarms}
            description={dict.products.emptyBody}
            action={
              <ButtonLink
                href={productsPath(`deliver=${atoll.code}`)}
                variant="secondary"
              >
                {dict.filters.deliverTo}: {name}
              </ButtonLink>
            }
          />
        ) : (
          <ProductGrid
            listings={products.items.slice(0, 8)}
            locale={locale}
            dict={dict}
            now={await catalogNow()}
          />
        )}
      </Section>
    </Container>
  );
}
