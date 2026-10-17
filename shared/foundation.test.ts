import { describe, expect, it } from "vitest";
import { ATOLLS } from "./constants/geography";
import { SAMPLE_ISLANDS } from "./constants/sample-islands";
import { PRODUCT_CATEGORIES, PRODUCT_UNITS } from "./constants/catalog";
import { dictionaries } from "./i18n";
import { productInputSchema, mvPhoneSchema } from "./schemas";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return [prefix];
  return Object.entries(value).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("geography", () => {
  it("has 20 atolls plus Malé City with unique codes", () => {
    expect(ATOLLS).toHaveLength(21);
    expect(new Set(ATOLLS.map((a) => a.code)).size).toBe(ATOLLS.length);
  });

  it("seeds islands with unique ids in known atolls", () => {
    const codes = new Set<string>(ATOLLS.map((a) => a.code));
    expect(new Set(SAMPLE_ISLANDS.map((i) => i.id)).size).toBe(
      SAMPLE_ISLANDS.length,
    );
    for (const island of SAMPLE_ISLANDS)
      expect(codes.has(island.atollCode)).toBe(true);
  });
});

describe("dictionaries", () => {
  it("English and Dhivehi have exactly the same keys", () => {
    expect(keyPaths(dictionaries.dv).sort()).toEqual(
      keyPaths(dictionaries.en).sort(),
    );
  });

  it("have no empty strings", () => {
    for (const dict of Object.values(dictionaries)) {
      const empty = keyPaths(dict).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict);
        return typeof value !== "string" || value.trim() === "";
      });
      expect(empty).toEqual([]);
    }
  });

  it("label every category and unit", () => {
    for (const dict of Object.values(dictionaries)) {
      expect(Object.keys(dict.categories).sort()).toEqual(
        [...PRODUCT_CATEGORIES].sort(),
      );
      expect(Object.keys(dict.units).sort()).toEqual([...PRODUCT_UNITS].sort());
    }
  });
});

describe("schemas", () => {
  it("normalises phone numbers during parsing", () => {
    expect(mvPhoneSchema.parse("777 1234")).toBe("+9607771234");
    expect(mvPhoneSchema.safeParse("123").success).toBe(false);
  });

  it("accepts a valid listing and rejects a zero price", () => {
    const listing = {
      title: { en: "Chillies" },
      category: "vegetables",
      unit: "kg",
      priceLaari: 4500,
      quantityAvailable: 20,
      deliveryDestinations: [{ atollCode: "K" }],
      status: "active",
      imagePaths: [],
    };
    expect(productInputSchema.safeParse(listing).success).toBe(true);
    expect(
      productInputSchema.safeParse({ ...listing, priceLaari: 0 }).success,
    ).toBe(false);
    expect(
      productInputSchema.safeParse({ ...listing, status: "removed" }).success,
    ).toBe(false);
  });
});
