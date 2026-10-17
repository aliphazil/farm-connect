import Link from "next/link";
import { placeText } from "@shared/constants/geography";
import { pickLocalized, type Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { localeHref } from "@/i18n/paths";
import type { FarmerCard as FarmerCardData } from "@/features/catalog/types";
import { Badge } from "@/components/ui/layout-primitives";
import { PinIcon, VerifiedIcon } from "@/components/ui/icons";
import { ProductImage } from "./product-image";

export function FarmerCard({
  farmer,
  locale,
  dict,
}: {
  farmer: FarmerCardData;
  locale: Locale;
  dict: Dictionary;
}) {
  const name = pickLocalized(farmer.farmName, locale);
  const count =
    farmer.listingCount === 1
      ? dict.farmers.productsOne
      : fill(dict.farmers.productsMany, { count: farmer.listingCount });

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-primary hover:shadow-md">
      <div className="relative aspect-[16/9] bg-primary-soft">
        <ProductImage
          image={farmer.coverImage}
          alt=""
          category="other"
          sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 92vw"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-base font-semibold">
          <Link
            href={localeHref(locale, `/farmers/${farmer.id}`)}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {name}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <PinIcon className="size-4 shrink-0" />
          {placeText(farmer.place, locale)}
        </p>
        {farmer.bio ? (
          <p className="line-clamp-2 text-sm text-muted">
            {pickLocalized(farmer.bio, locale)}
          </p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {farmer.verified ? (
            <Badge tone="success" className="gap-1">
              <VerifiedIcon className="size-3.5" />
              {dict.common.verified}
            </Badge>
          ) : null}
          <Badge>{count}</Badge>
        </div>
      </div>
    </article>
  );
}

export function FarmerGrid({
  farmers,
  locale,
  dict,
}: {
  farmers: readonly FarmerCardData[];
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5 lg:grid-cols-4">
      {farmers.map((farmer) => (
        <li key={farmer.id}>
          <FarmerCard farmer={farmer} locale={locale} dict={dict} />
        </li>
      ))}
    </ul>
  );
}
