import type { Metadata } from "next";
import Link from "next/link";
import { atollName, getAtoll } from "@shared/constants/geography";
import { fill } from "@shared/i18n/format";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { getAtollSummaries, isSampleCatalog } from "@/features/catalog/queries";
import { SampleDataNotice } from "@/components/catalog/sample-data-notice";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ChevronIcon } from "@/components/ui/icons";
import { Container, PageHeader } from "@/components/ui/layout-primitives";
import { cn } from "@/lib/cn";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.locations.title, description: dict.locations.intro };
}

export default async function LocationsPage() {
  const [locale, dict, summaries] = await Promise.all([
    getLocale(),
    getDictionary(),
    getAtollSummaries(),
  ]);
  // Atolls with farms first, then the rest in official (north→south) order.
  const ordered = [...summaries].sort(
    (a, b) => Number(b.farmCount > 0) - Number(a.farmCount > 0),
  );

  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          { label: dict.locations.title },
        ]}
      />
      <PageHeader
        title={dict.locations.title}
        description={dict.locations.intro}
      />
      {isSampleCatalog ? (
        <SampleDataNotice dict={dict} className="mb-6" />
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((summary) => {
          const atoll = getAtoll(summary.code)!;
          const hasFarms = summary.farmCount > 0;
          return (
            <li key={summary.code}>
              <Link
                href={localeHref(
                  locale,
                  `/locations/${summary.code.toLowerCase()}`,
                )}
                className={cn(
                  "flex h-full items-center justify-between gap-3 rounded-xl border p-4 transition-colors hover:border-primary hover:bg-primary-soft",
                  hasFarms
                    ? "border-border bg-surface"
                    : "border-dashed border-border bg-background",
                )}
              >
                <span>
                  <span className="block font-semibold">
                    {atollName(atoll, locale)}
                  </span>
                  <span className="block text-sm text-muted">
                    {hasFarms
                      ? `${fill(dict.locations.farmsCount, { count: summary.farmCount })} · ${fill(dict.locations.productsCount, { count: summary.productCount })}`
                      : dict.locations.noFarms}
                  </span>
                </span>
                <ChevronIcon className="size-4 shrink-0 text-muted" />
              </Link>
            </li>
          );
        })}
      </ul>
    </Container>
  );
}
