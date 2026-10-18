import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { placeText } from "@shared/constants/geography";
import { pickLocalized } from "@shared/constants/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import {
  catalogNow,
  getFarmer,
  getFarmerIds,
  getListingsByFarmer,
  isSampleCatalog,
} from "@/features/catalog/queries";
import { FarmerBuyerActions } from "@/features/consumer/buyer-actions";
import { ContactActions } from "@/components/catalog/contact-actions";
import { contactLabels } from "@/components/catalog/product-detail";
import { TrackView } from "@/components/catalog/track-view";
import { DeliveryList } from "@/components/catalog/delivery-list";
import { ProductGrid } from "@/components/catalog/product-grid";
import { ProductImage } from "@/components/catalog/product-image";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { PinIcon, TruckIcon, VerifiedIcon } from "@/components/ui/icons";
import { Badge, Container } from "@/components/ui/layout-primitives";
import { Section } from "@/components/ui/section";

export async function generateStaticParams() {
  const ids = await getFarmerIds();
  // Cache Components needs at least one param at build time. On a new
  // deployment there may be no records yet, so fall back to a placeholder
  // that renders "not found"; real ids still render on demand.
  return (ids.length ? ids : ["__placeholder__"]).map((id) => ({ id }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/farmers/[id]">): Promise<Metadata> {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const farmer = await getFarmer(id);
  if (!farmer) return {};
  return {
    title: pickLocalized(farmer.farmName, locale),
    description: farmer.bio ? pickLocalized(farmer.bio, locale) : undefined,
  };
}

export default async function FarmerProfilePage({
  params,
}: PageProps<"/[locale]/farmers/[id]">) {
  const { id } = await params;
  const farmer = await getFarmer(id);
  if (!farmer) notFound();

  const [locale, dict, listings] = await Promise.all([
    getLocale(),
    getDictionary(),
    getListingsByFarmer(id),
  ]);
  const name = pickLocalized(farmer.farmName, locale);

  return (
    <>
      <div className="relative h-40 bg-primary-soft sm:h-56">
        <ProductImage
          image={farmer.coverImage}
          alt=""
          category="other"
          sizes="100vw"
          priority
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/40 to-transparent"
        />
      </div>
      <Container className="py-8">
        <Breadcrumbs
          label={dict.common.breadcrumb}
          items={[
            { label: dict.nav.home, href: localeHref(locale) },
            { label: dict.farmers.title, href: localeHref(locale, "/farmers") },
            { label: name },
          ]}
        />
        {isSampleCatalog ? (
          <SampleDataNotice dict={dict} className="mb-6" />
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-muted">
              <span className="flex items-center gap-1.5">
                <PinIcon className="size-4" />
                <span className="sr-only">{dict.farmers.location}:</span>
                {placeText(farmer.place, locale)}
              </span>
              {farmer.verified ? (
                <Badge tone="success" className="gap-1">
                  <VerifiedIcon className="size-3.5" />
                  {dict.common.verified}
                </Badge>
              ) : null}
            </div>
            {farmer.bio ? (
              <div className="mt-6">
                <h2 className="font-semibold">{dict.farmers.about}</h2>
                <p className="mt-1 max-w-2xl text-muted">
                  {pickLocalized(farmer.bio, locale)}
                </p>
              </div>
            ) : null}
          </div>

          <aside className="flex flex-col gap-5 rounded-xl border border-border bg-surface p-5 lg:self-start">
            {isSampleCatalog ? null : (
              <Suspense fallback={null}>
                <FarmerBuyerActions
                  farmerId={farmer.id}
                  locale={locale}
                  dict={dict}
                />
              </Suspense>
            )}
            <div>
              <h2 className="font-semibold">{dict.products.contactTitle}</h2>
              <p className="mt-1 mb-3 text-sm text-muted">
                {dict.products.contactBody}
              </p>
              <ContactActions
                contact={farmer.contact}
                labels={contactLabels(dict)}
                message={name}
                track={isSampleCatalog ? undefined : { farmerId: farmer.id }}
              />
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <TruckIcon className="size-5 text-primary" />
                {dict.farmers.deliveryAreas}
              </h2>
              <div className="mt-2">
                <DeliveryList
                  destinations={farmer.deliveryDestinations}
                  pickupAvailable={farmer.pickupAvailable}
                  locale={locale}
                  dict={dict}
                />
              </div>
            </div>
          </aside>
        </div>

        {isSampleCatalog ? null : (
          <TrackView type="farmer_view" farmerId={farmer.id} />
        )}
        <Section id="farm-products" title={dict.farmers.products}>
          {listings.length === 0 ? (
            <EmptyState icon="🧺" title={dict.farmers.noProducts} />
          ) : (
            <ProductGrid
              listings={listings}
              locale={locale}
              dict={dict}
              now={await catalogNow()}
            />
          )}
        </Section>
      </Container>
    </>
  );
}
