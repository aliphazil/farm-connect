import Link from "next/link";
import { placeText } from "@shared/constants/geography";
import { pickLocalized } from "@shared/constants/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { listConsumerFavourites } from "@/services/server/consumer";
import { catalogNow } from "@/features/catalog/queries";
import { FavouriteButton } from "@/features/consumer/components/favourite-button";
import { ProductCard } from "@/components/catalog/product-card";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function FavouritesPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, saved, now] = await Promise.all([
    getLocale(),
    getDictionary(),
    listConsumerFavourites(user.uid),
    catalogNow(),
  ]);
  const t = dict.account.favourites;
  const removeLabels = {
    save: dict.products.save,
    saved: t.remove,
    unsave: t.remove,
    failed: dict.products.saveFailed,
  };

  if (saved.products.length === 0 && saved.farms.length === 0) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={t.title} description={t.intro} />
        <EmptyState
          icon="♡"
          title={t.empty}
          description={t.emptyBody}
          action={
            <ButtonLink href={localeHref(locale, "/products")}>
              {dict.account.overview.browse}
            </ButtonLink>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t.title} description={t.intro} />
      {saved.products.length > 0 ? (
        <section aria-labelledby="saved-products">
          <h2 id="saved-products" className="mb-3 text-lg font-semibold">
            {t.products}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {saved.products.map((p) => (
              <li key={p.favouriteId} className="flex flex-col gap-2">
                {p.listing ? (
                  <ProductCard
                    listing={p.listing}
                    locale={locale}
                    dict={dict}
                    now={now}
                  />
                ) : (
                  <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted">
                    {t.unavailable}
                  </p>
                )}
                <FavouriteButton
                  targetType="product"
                  targetId={p.productId}
                  initialSaved
                  labels={removeLabels}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {saved.farms.length > 0 ? (
        <section aria-labelledby="saved-farms">
          <h2 id="saved-farms" className="mb-3 text-lg font-semibold">
            {t.farms}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {saved.farms.map((f) => (
              <li
                key={f.favouriteId}
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
              >
                {f.farm ? (
                  <div>
                    <Link
                      href={localeHref(locale, `/farmers/${f.farmerId}`)}
                      className="font-semibold text-primary hover:underline"
                    >
                      {pickLocalized(f.farm.farmName, locale)}
                    </Link>
                    <p className="text-sm text-muted">
                      {placeText(f.farm.place, locale)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t.unavailable}</p>
                )}
                <FavouriteButton
                  targetType="farmer"
                  targetId={f.farmerId}
                  initialSaved
                  labels={removeLabels}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
