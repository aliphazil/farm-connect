import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PRODUCT_CATEGORIES } from "@shared/constants/catalog";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { categoryToSlug, slugToCategory } from "@/features/catalog/categories";
import { getCategoryCounts, isSampleCatalog } from "@/features/catalog/queries";
import { CategoryNav } from "@/components/catalog/category-nav";
import {
  ProductsBrowser,
  ProductsBrowserFallback,
} from "@/components/catalog/products-browser";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, PageHeader } from "@/components/ui/layout-primitives";

export async function generateStaticParams() {
  return PRODUCT_CATEGORIES.map((c) => ({ category: categoryToSlug(c) }));
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/categories/[category]">): Promise<Metadata> {
  const [{ category: slug }, dict] = await Promise.all([
    params,
    getDictionary(),
  ]);
  const category = slugToCategory(slug);
  return category ? { title: dict.categories[category] } : {};
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/[locale]/categories/[category]">) {
  const { category: slug } = await params;
  const category = slugToCategory(slug);
  if (!category) notFound();
  const [locale, dict, counts] = await Promise.all([
    getLocale(),
    getDictionary(),
    getCategoryCounts(),
  ]);
  const basePath = localeHref(locale, `/categories/${slug}`);

  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          {
            label: dict.categoryPage.title,
            href: localeHref(locale, "/categories"),
          },
          { label: dict.categories[category] },
        ]}
      />
      <PageHeader title={dict.categories[category]} />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}
      <div className="mb-6">
        <CategoryNav
          locale={locale}
          dict={dict}
          counts={counts}
          current={category}
          label={dict.nav.categories}
        />
      </div>
      <Suspense fallback={<ProductsBrowserFallback dict={dict} />}>
        <ProductsBrowser
          searchParams={searchParams}
          basePath={basePath}
          locale={locale}
          dict={dict}
          fixedCategory={category}
        />
      </Suspense>
    </Container>
  );
}
