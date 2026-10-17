import { describe, expect, it } from "vitest";
import { SAMPLE_ISLANDS } from "@shared/constants/sample-islands";
import {
  applyFilters,
  availabilityOf,
  filtersToSearchParams,
  paginate,
  parseCatalogFilters,
} from "./filters";
import type { ListingCard } from "./types";

const now = new Date("2026-10-15T07:00:00Z");

function listing(overrides: Partial<ListingCard> & { id: string }) {
  const base: ListingCard = {
    id: overrides.id,
    title: { en: "Item" },
    category: "vegetables",
    unit: "kg",
    priceLaari: 1000,
    quantityAvailable: 10,
    status: "active",
    image: null,
    atollCode: "K",
    islandId: "k-thulusdhoo",
    place: { atollCode: "K", islandId: "k-thulusdhoo", islandEn: "Thulusdhoo" },
    farmer: { id: "f", farmName: { en: "Farm" }, verified: false },
    createdAt: new Date("2026-10-01"),
  };
  const card = { ...base, ...overrides };
  return {
    ...card,
    deliveryDestinations: [{ atollCode: card.atollCode }],
    searchText: `${card.title.en} ${card.title.dv ?? ""}`.toLowerCase(),
  };
}

describe("parseCatalogFilters", () => {
  it("parses valid params", () => {
    const f = parseCatalogFilters(
      {
        q: " papaya ",
        category: "fruits",
        atoll: "AA",
        island: "aa-thoddoo",
        min: "10",
        max: "25.5",
        available: "1",
        deliver: "MLE",
        sort: "price_asc",
        page: "2",
      },
      SAMPLE_ISLANDS,
    );
    expect(f).toEqual({
      q: "papaya",
      category: "fruits",
      atoll: "AA",
      island: "aa-thoddoo",
      minPriceLaari: 1000,
      maxPriceLaari: 2550,
      availableNow: true,
      deliverTo: "MLE",
      sort: "price_asc",
      page: 2,
    });
  });

  it("ignores invalid values instead of failing", () => {
    const f = parseCatalogFilters({
      category: "cars",
      atoll: "XX",
      min: "abc",
      sort: "random",
      page: "-3",
    });
    expect(f).toEqual({
      q: undefined,
      category: undefined,
      atoll: undefined,
      island: undefined,
      minPriceLaari: undefined,
      maxPriceLaari: undefined,
      availableNow: undefined,
      deliverTo: undefined,
      sort: "newest",
      page: 1,
    });
  });

  it("ignores islands that aren't in the source's island records", () => {
    expect(
      parseCatalogFilters({ island: "made-up-island" }, SAMPLE_ISLANDS).island,
    ).toBeUndefined();
    expect(
      parseCatalogFilters({ island: "aa-thoddoo" }, []).island,
    ).toBeUndefined();
  });

  it("infers the atoll from an island and drops mismatched islands", () => {
    expect(
      parseCatalogFilters({ island: "aa-thoddoo" }, SAMPLE_ISLANDS).atoll,
    ).toBe("AA");
    expect(
      parseCatalogFilters({ atoll: "K", island: "aa-thoddoo" }, SAMPLE_ISLANDS)
        .island,
    ).toBeUndefined();
  });

  it("round-trips through search params", () => {
    const f = parseCatalogFilters({
      q: "egg",
      min: "5",
      sort: "price_desc",
      page: "3",
    });
    expect(filtersToSearchParams(f).toString()).toBe(
      "q=egg&min=5&sort=price_desc&page=3",
    );
    expect(filtersToSearchParams(f, { page: 1 }).toString()).toBe(
      "q=egg&min=5&sort=price_desc",
    );
  });
});

describe("availabilityOf", () => {
  it("distinguishes available, upcoming and sold out", () => {
    expect(
      availabilityOf({ status: "active", quantityAvailable: 5 }, now),
    ).toEqual({
      kind: "available",
      quantity: 5,
    });
    const from = new Date("2026-11-01");
    expect(
      availabilityOf(
        { status: "active", quantityAvailable: 5, availableFrom: from },
        now,
      ),
    ).toEqual({ kind: "upcoming", from });
    expect(
      availabilityOf({ status: "sold_out", quantityAvailable: 5 }, now).kind,
    ).toBe("sold_out");
    expect(
      availabilityOf({ status: "active", quantityAvailable: 0 }, now).kind,
    ).toBe("sold_out");
  });
});

describe("applyFilters", () => {
  const items = [
    listing({
      id: "a",
      title: { en: "Papaya", dv: "ފަޅޯ" },
      category: "fruits",
      priceLaari: 2500,
      atollCode: "AA",
      islandId: "aa-thoddoo",
      createdAt: new Date("2026-10-10"),
    }),
    listing({
      id: "b",
      title: { en: "Chillies" },
      priceLaari: 9000,
      createdAt: new Date("2026-10-12"),
    }),
    listing({
      id: "c",
      title: { en: "Mango" },
      category: "fruits",
      status: "sold_out",
      priceLaari: 5500,
      createdAt: new Date("2026-09-01"),
    }),
  ];

  it("searches English and Dhivehi titles", () => {
    expect(
      applyFilters(items, parseCatalogFilters({ q: "PAPAYA" }), now).map(
        (l) => l.id,
      ),
    ).toEqual(["a"]);
    expect(
      applyFilters(items, parseCatalogFilters({ q: "ފަޅޯ" }), now).map(
        (l) => l.id,
      ),
    ).toEqual(["a"]);
  });

  it("filters by category, atoll, price and availability", () => {
    const run = (p: Record<string, string>) =>
      applyFilters(items, parseCatalogFilters(p), now).map((l) => l.id);
    expect(run({ category: "fruits" })).toEqual(["a", "c"]);
    expect(run({ atoll: "AA" })).toEqual(["a"]);
    expect(run({ min: "30", max: "60" })).toEqual(["c"]);
    expect(run({ category: "fruits", available: "1" })).toEqual(["a"]);
  });

  it("filters by delivery destination", () => {
    const run = (p: Record<string, string>) =>
      applyFilters(items, parseCatalogFilters(p), now).map((l) => l.id);
    expect(run({ deliver: "AA" })).toEqual(["a"]);
    expect(run({ deliver: "S" })).toEqual([]);
  });

  it("sorts", () => {
    const run = (sort: string) =>
      applyFilters(items, parseCatalogFilters({ sort }), now).map((l) => l.id);
    expect(run("newest")).toEqual(["b", "a", "c"]);
    expect(run("price_asc")).toEqual(["a", "c", "b"]);
    expect(run("price_desc")).toEqual(["b", "c", "a"]);
  });
});

describe("paginate", () => {
  it("splits into pages and clamps out-of-range pages", () => {
    const nums = Array.from({ length: 25 }, (_, i) => i);
    expect(paginate(nums, 1, 10)).toMatchObject({
      items: nums.slice(0, 10),
      total: 25,
      page: 1,
      pageCount: 3,
    });
    expect(paginate(nums, 9, 10)).toMatchObject({
      items: nums.slice(20),
      page: 3,
    });
    expect(paginate([], 1, 10)).toMatchObject({
      items: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
  });
});
