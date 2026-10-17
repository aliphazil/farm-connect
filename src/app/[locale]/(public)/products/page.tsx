import type { Metadata } from "next";
import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { getCategoryCounts, isSampleCatalog } from "@/features/catalog/queries";
import { CategoryNav } from "@/components/catalog/category-nav";
import {
  ProductsBrowser,
  ProductsBrowserFallback,
} from "@/components/catalog/products-browser";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, PageHeader } from "@/components/ui/layout-primitives";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.products.title, description: dict.products.intro };
}

export default async function ProductsPage({
  searchParams,
}: PageProps<"/[locale]/products">) {
  const [locale, dict, counts] = await Promise.all([
    getLocale(),
    getDictionary(),
    getCategoryCounts(),
  ]);

  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          { label: dict.products.title },
        ]}
      />
      <PageHeader
        title={dict.products.title}
        description={dict.products.intro}
      />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}
      <div className="mb-6">
        <CategoryNav
          locale={locale}
          dict={dict}
          counts={counts}
          label={dict.nav.categories}
        />
      </div>
      <Suspense fallback={<ProductsBrowserFallback dict={dict} />}>
        <ProductsBrowser
          searchParams={searchParams}
          basePath={localeHref(locale, "/products")}
          locale={locale}
          dict={dict}
        />
      </Suspense>
    </Container>
  );
}
