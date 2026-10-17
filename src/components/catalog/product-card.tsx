import Link from "next/link";
import { pickLocalized, type Locale } from "@shared/constants/locales";
import { placeText } from "@shared/constants/geography";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { availabilityOf } from "@/features/catalog/filters";
import type { ListingCard } from "@/features/catalog/types";
import { ChevronIcon, PinIcon, VerifiedIcon } from "@/components/ui/icons";
import { AvailabilityLine } from "./availability";
import { Price } from "./price";
import { ProductImage } from "./product-image";

const CARD_IMAGE_SIZES =
  "(min-width: 1280px) 280px, (min-width: 640px) 45vw, 92vw";

/**
 * The whole card is clickable via the title link's stretched ::after, so
 * there is one link per card for keyboard and screen-reader users.
 */
export function ProductCard({
  listing,
  locale,
  dict,
  now,
  priority,
}: {
  listing: ListingCard;
  locale: Locale;
  dict: Dictionary;
  now: Date;
  priority?: boolean;
}) {
  const title = pickLocalized(listing.title, locale);
  const availability = availabilityOf(listing, now);
  const soldOut = availability.kind === "sold_out";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary hover:shadow-md">
      <div className="relative aspect-[4/3] overflow-hidden bg-primary-soft">
        <ProductImage
          image={listing.image}
          alt={title}
          category={listing.category}
          sizes={CARD_IMAGE_SIZES}
          priority={priority}
          className={
            soldOut
              ? "opacity-60 grayscale"
              : "transition-transform duration-300 group-hover:scale-[1.03]"
          }
        />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-medium tracking-wide text-primary uppercase">
          {dict.categories[listing.category]}
        </p>
        <h3 className="text-base leading-snug font-semibold">
          <Link
            href={localeHref(locale, `/products/${listing.id}`)}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {title}
          </Link>
        </h3>
        <Price
          laari={listing.priceLaari}
          unit={listing.unit}
          locale={locale}
          dict={dict}
        />
        <AvailabilityLine
          availability={availability}
          unit={listing.unit}
          locale={locale}
          dict={dict}
        />
        <div className="mt-auto space-y-1 border-t border-border pt-3 text-sm text-muted">
          <p className="flex items-center gap-1.5 text-foreground">
            <span className="truncate">
              {pickLocalized(listing.farmer.farmName, locale)}
            </span>
            {listing.farmer.verified ? (
              <>
                <VerifiedIcon className="size-4 shrink-0 text-primary" />
                <span className="sr-only">({dict.common.verified})</span>
              </>
            ) : null}
          </p>
          <p className="flex items-center gap-1.5">
            <PinIcon className="size-4 shrink-0" />
            {placeText(listing.place, locale)}
          </p>
        </div>
        <p
          aria-hidden="true"
          className="flex items-center gap-1 pt-1 text-sm font-semibold text-primary"
        >
          {dict.common.viewDetails}
          <ChevronIcon className="size-4 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
        </p>
      </div>
    </article>
  );
}
