import "server-only";

import {
  atollName,
  getAtoll,
  islandName,
  type Island,
} from "@shared/constants/geography";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { DeliveryArea } from "@shared/schemas";
import type { DeliveryOption } from "./components/product-form";

/** "Thoddoo (AA)" for an island, "Kaafu (whole atoll)" for a whole atoll. */
export function areaLabel(
  area: Pick<DeliveryArea, "atollCode" | "islandId">,
  islands: Map<string, Island>,
  locale: Locale,
  dict: Dictionary,
): string {
  const atoll = getAtoll(area.atollCode);
  const atollLabel = atoll ? atollName(atoll, locale) : area.atollCode;
  if (!area.islandId)
    return fill(dict.products.wholeAtoll, { atoll: atollLabel });
  const island = islands.get(area.islandId);
  return `${island ? islandName(island, locale) : area.islandId} (${atollLabel})`;
}

export function deliveryOptions(
  areas: DeliveryArea[],
  islands: Map<string, Island>,
  locale: Locale,
  dict: Dictionary,
): DeliveryOption[] {
  return areas
    .filter((a) => a.active)
    .map((a) => ({
      key: `${a.atollCode}:${a.islandId ?? ""}`,
      label: areaLabel(a, islands, locale, dict),
      destination: a.islandId
        ? { atollCode: a.atollCode, islandId: a.islandId }
        : { atollCode: a.atollCode },
    }));
}
