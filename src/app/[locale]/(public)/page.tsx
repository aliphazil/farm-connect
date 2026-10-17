import Image from "next/image";
import Link from "next/link";
import { atollName, getAtoll } from "@shared/constants/geography";
import { fill } from "@shared/i18n/format";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import {
  catalogNow,
  getAtollSummaries,
  getCategoryCounts,
  getFeaturedFarmers,
  getFeaturedListings,
  getRecentListings,
  isSampleCatalog,
} from "@/features/catalog/queries";
import { SAMPLE_HERO_IMAGE } from "@/features/catalog/sample/data";
import { CategoryNav } from "@/components/catalog/category-nav";
import { FarmerGrid } from "@/components/catalog/farmer-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { SearchForm } from "@/components/catalog/search-form";
import { ButtonLink } from "@/components/ui/button";
import { ChevronIcon, PinIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout-primitives";
import { Section } from "@/components/ui/section";

export default async function HomePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const [featured, recent, farmers, atolls, counts] = await Promise.all([
    getFeaturedListings(),
    getRecentListings(4),
    getFeaturedFarmers(),
    getAtollSummaries(),
    getCategoryCounts(),
  ]);
  const now = await catalogNow();
  const href = (path: string) => localeHref(locale, path);
  const atollsWithFarms = atolls.filter((a) => a.farmCount > 0);

  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <Image
          src={`/${SAMPLE_HERO_IMAGE}`}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-35"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-primary via-primary/70 to-primary/30"
        />
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-5xl">
              {dict.home.heroTitle}
            </h1>
            <p className="mt-4 text-lg text-white/90">{dict.home.heroBody}</p>
            <SearchForm
              locale={locale}
              dict={dict}
              id="home-search"
              size="lg"
              className="mt-8 rounded-lg shadow-lg"
            />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href={href("/products")}
                variant="secondary"
                size="lg"
              >
                {dict.home.browseCta}
              </ButtonLink>
              <ButtonLink
                href={`${href("/register")}#farmer`}
                size="lg"
                className="border border-white/70 bg-transparent hover:bg-white/10"
              >
                {dict.nav.registerFarmer}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        {isSampleCatalog ? (
          <SampleDataNotice dict={dict} className="mt-6" />
        ) : null}

        <Section
          id="categories"
          title={dict.home.categoriesTitle}
          action={{ href: href("/categories"), label: dict.common.viewAll }}
        >
          <CategoryNav
            locale={locale}
            dict={dict}
            counts={counts}
            label={dict.home.categoriesTitle}
          />
        </Section>

        <Section
          id="featured"
          title={dict.home.featuredTitle}
          action={{ href: href("/products"), label: dict.common.viewAll }}
          className="pt-0 sm:pt-0"
        >
          <ProductGrid
            listings={featured}
            locale={locale}
            dict={dict}
            now={now}
          />
        </Section>

        <Section
          id="recent"
          title={dict.home.recentTitle}
          action={{ href: href("/products"), label: dict.common.viewAll }}
          className="pt-0 sm:pt-0"
        >
          <ProductGrid
            listings={recent}
            locale={locale}
            dict={dict}
            now={now}
          />
        </Section>
      </Container>

      {/* Featured farms */}
      <div className="bg-primary-soft/60">
        <Container>
          <Section
            id="farms"
            title={dict.home.farmersTitle}
            action={{ href: href("/farmers"), label: dict.common.viewAll }}
          >
            <FarmerGrid farmers={farmers} locale={locale} dict={dict} />
          </Section>
        </Container>
      </div>

      <Container>
        {/* Browse by island */}
        <Section
          id="islands"
          title={dict.home.islandsTitle}
          description={dict.home.islandsBody}
          action={{ href: href("/locations"), label: dict.common.viewAll }}
        >
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {atollsWithFarms.map((summary) => {
              const atoll = getAtoll(summary.code)!;
              return (
                <li key={summary.code}>
                  <Link
                    href={href(`/locations/${summary.code.toLowerCase()}`)}
                    className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary hover:bg-primary-soft"
                  >
                    <span className="flex items-center gap-3">
                      <PinIcon className="size-5 shrink-0 text-primary" />
                      <span>
                        <span className="block font-semibold">
                          {atollName(atoll, locale)}
                        </span>
                        <span className="block text-sm text-muted">
                          {fill(dict.locations.productsCount, {
                            count: summary.productCount,
                          })}
                        </span>
                      </span>
                    </span>
                    <ChevronIcon className="size-4 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* How it works */}
        <Section id="how" title={dict.home.howTitle} className="pt-0 sm:pt-0">
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              [dict.home.how1Title, dict.home.how1Body],
              [dict.home.how2Title, dict.home.how2Body],
              [dict.home.how3Title, dict.home.how3Body],
            ].map(([title, body], i) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full bg-primary-soft font-bold text-primary"
                >
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-1 text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Register as a farmer */}
        <section
          aria-labelledby="register-heading"
          className="mb-14 rounded-2xl bg-primary px-6 py-10 text-white sm:px-10"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 id="register-heading" className="text-2xl font-bold">
                {dict.home.registerTitle}
              </h2>
              <p className="mt-2 text-white/90">{dict.home.registerBody}</p>
            </div>
            <ButtonLink
              href={`${href("/register")}#farmer`}
              variant="secondary"
              size="lg"
              className="shrink-0"
            >
              {dict.nav.registerFarmer}
            </ButtonLink>
          </div>
        </section>
      </Container>
    </>
  );
}
