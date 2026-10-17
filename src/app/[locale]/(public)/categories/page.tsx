import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_CATEGORIES } from "@shared/constants/catalog";
import { fill } from "@shared/i18n/format";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { CATEGORY_ICON, categoryToSlug } from "@/features/catalog/categories";
import { getCategoryCounts, isSampleCatalog } from "@/features/catalog/queries";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, PageHeader } from "@/components/ui/layout-primitives";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: dict.categoryPage.title,
    description: dict.categoryPage.intro,
  };
}

export default async function CategoriesPage() {
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
          { label: dict.categoryPage.title },
        ]}
      />
      <PageHeader
        title={dict.categoryPage.title}
        description={dict.categoryPage.intro}
      />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {PRODUCT_CATEGORIES.map((category) => (
          <li key={category}>
            <Link
              href={localeHref(
                locale,
                `/categories/${categoryToSlug(category)}`,
              )}
              className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-5 transition-colors hover:border-primary hover:bg-primary-soft"
            >
              <span aria-hidden="true" className="text-3xl">
                {CATEGORY_ICON[category]}
              </span>
              <span className="font-semibold">{dict.categories[category]}</span>
              <span className="text-sm text-muted">
                {fill(dict.categoryPage.count, {
                  count: counts[category] ?? 0,
                })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
