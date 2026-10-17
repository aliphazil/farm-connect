import type { Metadata } from "next";
import { Suspense } from "react";
import { ATOLLS, ATOLL_CODES, atollName } from "@shared/constants/geography";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { isSampleCatalog, listFarmers } from "@/features/catalog/queries";
import { FarmerGrid } from "@/components/catalog/farmer-card";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Container,
  PageHeader,
  Skeleton,
} from "@/components/ui/layout-primitives";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.farmers.title, description: dict.farmers.intro };
}

export default async function FarmersPage({
  searchParams,
}: PageProps<"/[locale]/farmers">) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          { label: dict.farmers.title },
        ]}
      />
      <PageHeader title={dict.farmers.title} description={dict.farmers.intro} />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}
      <Suspense
        fallback={<FarmersFallback label={dict.states.loadingFarmers} />}
      >
        <FarmerDirectory
          searchParams={searchParams}
          locale={locale}
          dict={dict}
        />
      </Suspense>
    </Container>
  );
}

async function FarmerDirectory({
  searchParams,
  locale,
  dict,
}: {
  searchParams: PageProps<"/[locale]/farmers">["searchParams"];
  locale: Locale;
  dict: Dictionary;
}) {
  const raw = (await searchParams).atoll;
  const atoll = ATOLL_CODES.find(
    (c) => c === (Array.isArray(raw) ? raw[0] : raw),
  );
  const farmers = await listFarmers(atoll);
  const basePath = localeHref(locale, "/farmers");

  return (
    <>
      <form
        action={basePath}
        method="get"
        className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end"
      >
        <div className="sm:w-72">
          <label
            htmlFor="farmers-atoll"
            className="mb-1.5 block text-sm font-medium"
          >
            {dict.farmers.filterAtoll}
          </label>
          <select
            id="farmers-atoll"
            name="atoll"
            defaultValue={atoll ?? ""}
            className="block w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base"
          >
            <option value="">{dict.filters.anyAtoll}</option>
            {ATOLLS.map((a) => (
              <option key={a.code} value={a.code}>
                {atollName(a, locale)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="secondary">
          {dict.farmers.filterSubmit}
        </Button>
      </form>

      {farmers.length === 0 ? (
        <EmptyState
          icon="🧑‍🌾"
          title={dict.farmers.emptyTitle}
          description={dict.farmers.emptyBody}
          action={
            <ButtonLink href={basePath} variant="secondary">
              {dict.filters.clear}
            </ButtonLink>
          }
        />
      ) : (
        <FarmerGrid farmers={farmers} locale={locale} dict={dict} />
      )}
    </>
  );
}

function FarmersFallback({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4"
    >
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-xl" />
      ))}
    </div>
  );
}
