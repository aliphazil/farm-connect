import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import type { ListingCard } from "@/features/catalog/types";
import { Skeleton } from "@/components/ui/layout-primitives";
import { cn } from "@/lib/cn";
import { ProductCard } from "./product-card";

const gridClasses = "grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 sm:gap-5";

export function ProductGrid({
  listings,
  locale,
  dict,
  now,
  columns = 4,
  priorityCount = 0,
}: {
  listings: readonly ListingCard[];
  locale: Locale;
  dict: Dictionary;
  now: Date;
  columns?: 3 | 4;
  priorityCount?: number;
}) {
  return (
    <ul
      className={cn(
        gridClasses,
        columns === 4 ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3",
      )}
    >
      {listings.map((listing, i) => (
        <li key={listing.id}>
          <ProductCard
            listing={listing}
            locale={locale}
            dict={dict}
            now={now}
            priority={i < priorityCount}
          />
        </li>
      ))}
    </ul>
  );
}

export function ProductGridSkeleton({
  count = 8,
  columns = 4,
  label,
}: {
  count?: number;
  columns?: 3 | 4;
  label: string;
}) {
  return (
    <div role="status" aria-label={label}>
      <ul
        aria-hidden="true"
        className={cn(
          gridClasses,
          columns === 4 ? "lg:grid-cols-3 xl:grid-cols-4" : "lg:grid-cols-3",
        )}
      >
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-2 p-4">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
