import type { ProductUnit } from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatMVR } from "@shared/utils/money";
import { cn } from "@/lib/cn";

export function Price({
  laari,
  unit,
  locale,
  dict,
  size = "md",
}: {
  laari: number;
  unit: ProductUnit;
  locale: Locale;
  dict: Dictionary;
  size?: "md" | "lg";
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5">
      <span
        className={cn(
          "font-bold text-foreground",
          size === "lg" ? "text-3xl" : "text-lg",
        )}
      >
        {formatMVR(laari, locale)}
      </span>
      <span className="text-sm text-muted">
        {fill(dict.products.perUnit, { unit: dict.units[unit] })}
      </span>
    </p>
  );
}
