import Link from "next/link";
import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { cn } from "@/lib/cn";
import { CATEGORY_ICON, categoryToSlug } from "@/features/catalog/categories";

/**
 * Category links as horizontally scrolling chips (mobile) that wrap on larger
 * screens. Categories with no products can be hidden via `counts`.
 */
export function CategoryNav({
  locale,
  dict,
  counts,
  current,
  label,
}: {
  locale: Locale;
  dict: Dictionary;
  counts?: Partial<Record<ProductCategory, number>>;
  current?: ProductCategory;
  label: string;
}) {
  const categories = counts
    ? PRODUCT_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0)
    : PRODUCT_CATEGORIES;
  return (
    <nav
      aria-label={label}
      className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
    >
      <ul className="flex gap-2 sm:flex-wrap">
        {categories.map((category) => {
          const active = category === current;
          return (
            <li key={category} className="shrink-0">
              <Link
                href={localeHref(
                  locale,
                  `/categories/${categoryToSlug(category)}`,
                )}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-foreground hover:border-primary hover:bg-primary-soft",
                )}
              >
                <span aria-hidden="true">{CATEGORY_ICON[category]}</span>
                {dict.categories[category]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
