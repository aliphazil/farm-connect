import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import type { ProductCategory, ProductUnit } from "@shared/constants/catalog";
import type { Locale } from "@shared/constants/locales";
import { COLLECTIONS } from "@shared/firestore-paths";
import type { Dictionary } from "@shared/i18n";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * Admin-maintained labels and availability for categories and units
 * (`categories`, `units`). Ids are fixed in code; admins edit what buyers and
 * farmers see. Cached under the "reference" tag, which the admin actions
 * refresh. With the sample catalog (no Firebase), built-in labels are used.
 */

type Item = { label?: { en?: string; dv?: string }; active: boolean };
export type ReferenceSettings = {
  categories: Record<string, Item>;
  units: Record<string, Item>;
};

const EMPTY: ReferenceSettings = { categories: {}, units: {} };
const enabled = process.env.CATALOG_SOURCE === "firestore";

export async function getReferenceSettings(): Promise<ReferenceSettings> {
  "use cache";
  cacheTag("reference");
  cacheLife("hours");
  if (!enabled) return EMPTY;
  try {
    const db = getAdminDb();
    const [cats, units] = await Promise.all([
      db.collection(COLLECTIONS.categories).get(),
      db.collection(COLLECTIONS.units).get(),
    ]);
    const read = (docs: FirebaseFirestore.QueryDocumentSnapshot[]) =>
      Object.fromEntries(
        docs.map((d) => [
          d.id,
          { label: d.get("label"), active: d.get("active") !== false },
        ]),
      );
    return { categories: read(cats.docs), units: read(units.docs) };
  } catch (error) {
    console.error("Reference data unavailable; using built-in labels", error);
    return EMPTY;
  }
}

/** The dictionary with admin-edited category and unit labels applied. */
export function withReferenceLabels(
  dict: Dictionary,
  locale: Locale,
  ref: ReferenceSettings,
): Dictionary {
  const apply = <T extends Record<string, string>>(
    base: T,
    items: Record<string, Item>,
  ): T => {
    const out = { ...base } as Record<string, string>;
    for (const [id, item] of Object.entries(items)) {
      const label = item.label?.[locale]?.trim();
      if (label && id in out) out[id] = label;
    }
    return out as T;
  };
  if (!Object.keys(ref.categories).length && !Object.keys(ref.units).length)
    return dict;
  return {
    ...dict,
    categories: apply(dict.categories, ref.categories),
    units: apply(dict.units, ref.units),
  };
}

/** Categories/units switched off for new listings. */
export async function inactiveReference(): Promise<{
  categories: ProductCategory[];
  units: ProductUnit[];
}> {
  const ref = await getReferenceSettings();
  const off = (items: Record<string, Item>) =>
    Object.entries(items)
      .filter(([, i]) => !i.active)
      .map(([id]) => id);
  return {
    categories: off(ref.categories) as ProductCategory[],
    units: off(ref.units) as ProductUnit[],
  };
}
