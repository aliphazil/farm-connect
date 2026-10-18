import Link from "next/link";
import type { ReactNode } from "react";
import { placeText } from "@shared/constants/geography";
import { pickLocalized, type Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { localeHref } from "@/i18n/paths";
import { categoryToSlug } from "@/features/catalog/categories";
import { availabilityOf } from "@/features/catalog/filters";
import type { ListingDetail } from "@/features/catalog/types";
import {
  FlagIcon,
  PinIcon,
  TruckIcon,
  VerifiedIcon,
} from "@/components/ui/icons";
import { Badge } from "@/components/ui/layout-primitives";
import { AvailabilityLine } from "./availability";
import { ContactActions, type ContactLabels } from "./contact-actions";
import { DeliveryList } from "./delivery-list";
import { ImageCredit } from "./image-credit";
import { Price } from "./price";
import { ProductImage } from "./product-image";
import { TrackView } from "./track-view";

export function contactLabels(dict: Dictionary): ContactLabels {
  return {
    call: dict.products.call,
    whatsapp: dict.products.whatsapp,
    viber: dict.products.viber,
    opensNewTab: dict.common.opensNewTab,
    hidden: dict.sample.contactDisabled,
  };
}

/**
 * Product details as buyers see them. Used by the public product page and the
 * farmer's preview (`preview`: no tracking, no live contact or report links).
 */
export function ProductDetailView({
  listing,
  locale,
  dict,
  now,
  preview = false,
  track = false,
  actions,
}: {
  listing: ListingDetail;
  locale: Locale;
  dict: Dictionary;
  now: Date;
  preview?: boolean;
  /** Count views/contact clicks (real catalog only). */
  track?: boolean;
  /** Save / enquire / report for the current viewer (in <Suspense>). */
  actions?: ReactNode;
}) {
  const title = pickLocalized(listing.title, locale);
  const farmName = pickLocalized(listing.farmer.farmName, locale);
  const [main, ...more] = listing.images;
  const categoryHref = localeHref(
    locale,
    `/categories/${categoryToSlug(listing.category)}`,
  );

  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
      {track ? <TrackView type="product_view" productId={listing.id} /> : null}
      <div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-primary-soft">
          <ProductImage
            image={main ?? null}
            alt={title}
            category={listing.category}
            sizes="(min-width: 1024px) 560px, 100vw"
            priority
          />
        </div>
        <ImageCredit credit={main?.credit} dict={dict} />
        {more.length > 0 ? (
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
            {more.map((image, i) => (
              <li
                key={image.src}
                className="relative aspect-square overflow-hidden rounded-lg bg-primary-soft"
              >
                <ProductImage
                  image={image}
                  alt={`${title} (${i + 2})`}
                  category={listing.category}
                  sizes="120px"
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          {preview ? (
            <span className="text-sm font-medium tracking-wide text-primary uppercase">
              {dict.categories[listing.category]}
            </span>
          ) : (
            <Link
              href={categoryHref}
              className="text-sm font-medium tracking-wide text-primary uppercase hover:underline"
            >
              {dict.categories[listing.category]}
            </Link>
          )}
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h1>
        </div>

        <Price
          laari={listing.priceLaari}
          unit={listing.unit}
          locale={locale}
          dict={dict}
          size="lg"
        />

        <div className="space-y-1.5">
          <AvailabilityLine
            availability={availabilityOf(listing, now)}
            unit={listing.unit}
            locale={locale}
            dict={dict}
            className="text-base font-medium"
          />
          {listing.minOrderQuantity ? (
            <p className="text-sm text-muted">
              {fill(dict.products.minOrder, {
                quantity: listing.minOrderQuantity,
                unit: dict.units[listing.unit],
              })}
            </p>
          ) : null}
          {listing.harvestDate ? (
            <p className="text-sm text-muted">
              {fill(dict.products.harvested, {
                date: formatDate(listing.harvestDate, locale),
              })}
            </p>
          ) : null}
          <p className="text-sm text-muted">
            {fill(dict.products.listedOn, {
              date: formatDate(listing.createdAt, locale),
            })}
          </p>
        </div>

        {listing.description ? (
          <div>
            <h2 className="font-semibold">{dict.products.description}</h2>
            <p className="mt-1 whitespace-pre-line text-muted">
              {pickLocalized(listing.description, locale)}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm text-muted">{dict.products.soldBy}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2">
            {preview ? (
              <span className="text-lg font-semibold">{farmName}</span>
            ) : (
              <Link
                href={localeHref(locale, `/farmers/${listing.farmer.id}`)}
                className="text-lg font-semibold text-primary hover:underline"
              >
                {farmName}
              </Link>
            )}
            {listing.farmer.verified ? (
              <Badge tone="success" className="gap-1">
                <VerifiedIcon className="size-3.5" />
                {dict.common.verified}
              </Badge>
            ) : null}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <PinIcon className="size-4" />
            <span className="sr-only">{dict.products.farmLocation}:</span>
            {placeText(listing.place, locale)}
          </p>
        </div>

        <div>
          <h2 className="font-semibold">{dict.products.contactTitle}</h2>
          <p className="mt-1 mb-3 text-sm text-muted">
            {dict.products.contactBody}
          </p>
          <ContactActions
            contact={listing.farmer.contact}
            labels={contactLabels(dict)}
            message={title}
            track={
              track
                ? { farmerId: listing.farmer.id, productId: listing.id }
                : undefined
            }
          />
        </div>

        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <TruckIcon className="size-5 text-primary" />
            {dict.products.deliversTo}
          </h2>
          <div className="mt-2">
            <DeliveryList
              destinations={listing.deliveryDestinations}
              pickupAvailable={listing.pickupAvailable}
              locale={locale}
              dict={dict}
            />
          </div>
        </div>

        {actions ? (
          <div className="border-t border-border pt-4">
            <h2 className="mb-3 font-semibold">{dict.products.actionsTitle}</h2>
            {actions}
          </div>
        ) : null}

        {preview || actions ? null : (
          <div className="flex items-center gap-2 border-t border-border pt-4 text-sm text-muted">
            <FlagIcon className="size-4" />
            <span>{dict.products.reportTitle}</span>
            <Link
              href={localeHref(locale, "/reporting")}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {dict.products.reportCta}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
