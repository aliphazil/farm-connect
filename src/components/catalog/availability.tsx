import type { ProductUnit } from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatDate } from "@shared/utils/date";
import { cn } from "@/lib/cn";
import type { Availability } from "@/features/catalog/types";

const quantityFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

export function availabilityText(
  a: Availability,
  unit: ProductUnit,
  locale: Locale,
  dict: Dictionary,
): string {
  switch (a.kind) {
    case "available":
      return fill(dict.products.available, {
        quantity: quantityFormat.format(a.quantity),
        unit: dict.units[unit],
      });
    case "upcoming":
      return fill(dict.products.availableFrom, {
        date: formatDate(a.from, locale),
      });
    case "sold_out":
      return dict.products.soldOut;
  }
}

const dot: Record<Availability["kind"], string> = {
  available: "bg-success",
  upcoming: "bg-warning",
  sold_out: "bg-muted",
};

/** Status line with a coloured dot; the text carries the meaning, not the colour. */
export function AvailabilityLine(props: {
  availability: Availability;
  unit: ProductUnit;
  locale: Locale;
  dict: Dictionary;
  className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2 text-sm", props.className)}>
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          dot[props.availability.kind],
        )}
      />
      {availabilityText(
        props.availability,
        props.unit,
        props.locale,
        props.dict,
      )}
    </p>
  );
}
