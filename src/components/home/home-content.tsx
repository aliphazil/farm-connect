import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { atollName, getAtoll } from "@shared/constants/geography";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { HomeSectionId, SiteConfig } from "@shared/schemas";
import { localeHref } from "@/i18n/paths";
import type { AtollSummary } from "@/features/catalog/queries";
import { SAMPLE_HERO_IMAGE } from "@/features/catalog/sample/data";
import { storageObjectUrl } from "@/features/catalog/images";
import type { FarmerCard, ListingCard } from "@/features/catalog/types";
import { CategoryNav } from "@/components/catalog/category-nav";
import { FarmerGrid } from "@/components/catalog/farmer-card";
import { ProductGrid } from "@/components/catalog/product-grid";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { SearchForm } from "@/components/catalog/search-form";
import { RichText } from "@/components/content/rich-text";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { ChevronIcon, PinIcon } from "@/components/ui/icons";
import { Container } from "@/components/ui/layout-primitives";
import { Section } from "@/components/ui/section";

export type HomeData = {
  featured: ListingCard[];
  recent: ListingCard[];
  farmers: FarmerCard[];
  atolls: AtollSummary[];
  counts: Partial<Record<string, number>>;
  now: Date;
  isSample: boolean;
};

/**
 * The homepage, driven by the Branding Studio config: hero text, image and
 * buttons, section order and visibility, featured categories and promotions.
 * Used by the public homepage (published config) and the admin preview
 * (draft config).
 */
export function HomeContent({
  locale,
  dict,
  config,
  data,
}: {
  locale: Locale;
  dict: Dictionary;
  config: SiteConfig;
  data: HomeData;
}) {
  const href = (path: string) => localeHref(locale, path);
  /** Internal CTA paths may omit the locale ("/products" → "/en/products"). */
  const ctaHref = (path: string) =>
    /^\/(en|dv)(\/|$)/.test(path) ? path : href(path);
  const pick = (t: { en: string; dv: string }) =>
    (locale === "dv" ? t.dv || t.en : t.en || t.dv).trim();
  const home = config.home;
  const heroImage = home.heroImagePath
    ? storageObjectUrl(home.heroImagePath)
    : `/${SAMPLE_HERO_IMAGE}`;
  const atollsWithFarms = data.atolls.filter((a) => a.farmCount > 0);
  const secondaryLabel = home.secondaryCta ? pick(home.secondaryCta.label) : "";

  const sections: Record<HomeSectionId, () => ReactNode> = {
    categories: () => (
      <Container key="categories">
        <Section
          id="categories"
          title={dict.home.categoriesTitle}
          action={{ href: href("/categories"), label: dict.common.viewAll }}
        >
          <CategoryNav
            locale={locale}
            dict={dict}
            counts={data.counts}
            only={home.featuredCategories}
            label={dict.home.categoriesTitle}
          />
        </Section>
      </Container>
    ),
    featured: () => (
      <Container key="featured">
        <Section
          id="featured"
          title={dict.home.featuredTitle}
          action={{ href: href("/products"), label: dict.common.viewAll }}
        >
          <ProductGrid
            listings={data.featured}
            locale={locale}
            dict={dict}
            now={data.now}
          />
        </Section>
      </Container>
    ),
    recent: () => (
      <Container key="recent">
        <Section
          id="recent"
          title={dict.home.recentTitle}
          action={{ href: href("/products"), label: dict.common.viewAll }}
        >
          <ProductGrid
            listings={data.recent}
            locale={locale}
            dict={dict}
            now={data.now}
          />
        </Section>
      </Container>
    ),
    farms: () => (
      <div key="farms" className="bg-secondary">
        <Container>
          <Section
            id="farms"
            title={dict.home.farmersTitle}
            action={{ href: href("/farmers"), label: dict.common.viewAll }}
          >
            <FarmerGrid farmers={data.farmers} locale={locale} dict={dict} />
          </Section>
        </Container>
      </div>
    ),
    islands: () => (
      <Container key="islands">
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
                    className="flex min-h-16 items-center justify-between gap-3 rounded-[var(--card-radius)] border border-border bg-surface p-4 transition-colors hover:border-primary hover:bg-primary-soft"
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
      </Container>
    ),
    how: () => (
      <Container key="how">
        <Section id="how" title={dict.home.howTitle}>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              [dict.home.how1Title, dict.home.how1Body],
              [dict.home.how2Title, dict.home.how2Body],
              [dict.home.how3Title, dict.home.how3Body],
            ].map(([title, body], i) => (
              <li
                key={title}
                className="rounded-[var(--card-radius)] border border-border bg-surface p-5"
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
      </Container>
    ),
    promos: () =>
      home.promos.length ? (
        <Container key="promos">
          <section
            aria-label={dict.home.promosLabel}
            className="grid gap-4 py-10 md:grid-cols-3"
          >
            {home.promos.map((p, i) => (
              <article
                key={i}
                className="flex flex-col overflow-hidden rounded-[var(--card-radius)] border border-border bg-surface shadow-[var(--card-shadow)]"
              >
                {p.imagePath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded promo image from Storage
                  <img
                    src={storageObjectUrl(p.imagePath)}
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : null}
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <h2 className="text-lg font-semibold">{pick(p.title)}</h2>
                  <RichText source={pick(p.body)} className="text-muted" />
                  {p.link ? (
                    p.link.href.startsWith("/") ? (
                      <Link
                        href={ctaHref(p.link.href)}
                        className={buttonClasses(
                          "secondary",
                          "sm",
                          "mt-auto self-start",
                        )}
                      >
                        {pick(p.link.label)}
                      </Link>
                    ) : (
                      <a
                        href={p.link.href}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        className={buttonClasses(
                          "secondary",
                          "sm",
                          "mt-auto self-start",
                        )}
                      >
                        {pick(p.link.label)}
                        <span className="sr-only">
                          {" "}
                          {dict.common.opensNewTab}
                        </span>
                      </a>
                    )
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </Container>
      ) : null,
    register: () => (
      <Container key="register">
        <section
          aria-labelledby="register-heading"
          className="my-14 rounded-2xl bg-primary px-6 py-10 text-white sm:px-10"
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
    ),
  };

  return (
    <>
      <section className="relative isolate overflow-hidden bg-primary text-white">
        <Image
          src={heroImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover opacity-35"
          unoptimized={!!home.heroImagePath}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-linear-to-t from-primary via-primary/70 to-primary/30"
        />
        <Container className="py-14 sm:py-20 lg:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl tracking-tight text-balance sm:text-5xl">
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
                href={ctaHref(home.primaryCta.href)}
                variant="secondary"
                size="lg"
              >
                {dict.home.browseCta}
              </ButtonLink>
              <ButtonLink
                href={
                  home.secondaryCta
                    ? ctaHref(home.secondaryCta.href)
                    : `${href("/register")}#farmer`
                }
                size="lg"
                className="border border-white/70 bg-transparent hover:bg-white/10"
              >
                {secondaryLabel || dict.nav.registerFarmer}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>
      {data.isSample ? (
        <Container>
          <SampleDataNotice dict={dict} className="mt-6" />
        </Container>
      ) : null}
      {home.sections.filter((s) => s.visible).map((s) => sections[s.id]())}
    </>
  );
}
