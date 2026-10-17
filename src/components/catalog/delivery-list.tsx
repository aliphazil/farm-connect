import { atollName, getAtoll, islandName } from "@shared/constants/geography";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import { formatMVR } from "@shared/utils/money";
import type { DestinationView } from "@/features/catalog/types";

export function deliveryLabel(
  dest: DestinationView,
  locale: Locale,
  dict: Dictionary,
): string {
  if (dest.island) {
    return islandName(
      { nameEn: dest.island.islandEn, nameDv: dest.island.islandDv },
      locale,
    );
  }
  const atoll = getAtoll(dest.atollCode);
  return atoll
    ? fill(dict.products.wholeAtoll, { atoll: atollName(atoll, locale) })
    : dest.atollCode;
}

export function DeliveryList({
  destinations,
  pickupAvailable = false,
  locale,
  dict,
}: {
  destinations: readonly DestinationView[];
  pickupAvailable?: boolean;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {pickupAvailable ? (
        <li className="rounded-lg border border-primary/40 bg-primary-soft px-3 py-2 text-sm">
          {dict.products.pickup}
        </li>
      ) : null}
      {destinations.map((dest) => (
        <li
          key={`${dest.atollCode}-${dest.island?.islandId ?? "all"}`}
          className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg border border-border bg-background px-3 py-2 text-sm"
        >
          <span className="font-medium">
            {deliveryLabel(dest, locale, dict)}
          </span>
          {dest.method ? (
            <span className="text-muted">
              {dest.feeLaari !== undefined
                ? fill(dict.products.deliveryFee, {
                    method: dict.deliveryMethods[dest.method],
                    fee: formatMVR(dest.feeLaari, locale),
                  })
                : fill(dict.products.deliveryFeeAgreed, {
                    method: dict.deliveryMethods[dest.method],
                  })}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
