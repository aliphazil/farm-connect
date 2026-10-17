import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { pickLocalized } from "@shared/constants/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { categoryToSlug } from "@/features/catalog/categories";
import { availabilityOf } from "@/features/catalog/filters";
import { ProductBuyerActions } from "@/features/consumer/buyer-actions";
import {
  catalogNow,
  getListing,
  getListingIds,
  getListingsByFarmer,
  isSampleCatalog,
} from "@/features/catalog/queries";
import { ProductDetailView } from "@/components/catalog/product-detail";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/layout-primitives";
import { Section } from "@/components/ui/section";

export async function generateStaticParams() {
  const ids = await getListingIds();
  // Cache Components needs at least one param at build time. On a new
  // deployment there may be no records yet, so fall back to a placeholder
  // that renders "not found"; real ids still render on demand.
  return (ids.length ? ids : ["__placeholder__"]).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/products/[id]">): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const listing = await getListing(id);
  if (!listing) return {};
  return {
    title: pickLocalized(listing.title, locale),
    description: listing.description
      ? pickLocalized(listing.description, locale)
      : undefined,
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/[locale]/products/[id]">) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const [locale, dict, more] = await Promise.all([
    getLocale(),
    getDictionary(),
    getListingsByFarmer(listing.farmer.id, listing.id),
  ]);
  const now = await catalogNow();
  const title = pickLocalized(listing.title, locale);
  const farmName = pickLocalized(listing.farmer.farmName, locale);

  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          { label: dict.products.title, href: localeHref(locale, "/products") },
          {
            label: dict.categories[listing.category],
            href: localeHref(
              locale,
              `/categories/${categoryToSlug(listing.category)}`,
            ),
          },
          { label: title },
        ]}
      />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}

      <ProductDetailView
        listing={listing}
        locale={locale}
        dict={dict}
        now={now}
        track={!isSampleCatalog}
        actions={
          // Sample listings aren't in Firestore, so they can't be saved or enquired about.
          isSampleCatalog ? undefined : (
            <Suspense
              fallback={
                <p className="text-sm text-muted">{dict.common.loading}</p>
              }
            >
              <ProductBuyerActions
                product={{
                  id: listing.id,
                  farmerId: listing.farmer.id,
                  unitLabel: dict.units[listing.unit],
                  minOrder: listing.minOrderQuantity,
                  soldOut: availabilityOf(listing, now).kind === "sold_out",
                }}
                locale={locale}
                dict={dict}
              />
            </Suspense>
          )
        }
      />

      {more.length > 0 ? (
        <Section
          id="more"
          title={dict.products.moreFromFarm}
          action={{
            href: localeHref(locale, `/farmers/${listing.farmer.id}`),
            label: farmName,
          }}
        >
          <ProductGrid
            listings={more.slice(0, 4)}
            locale={locale}
            dict={dict}
            now={now}
          />
        </Section>
      ) : null}
    </Container>
  );
}
