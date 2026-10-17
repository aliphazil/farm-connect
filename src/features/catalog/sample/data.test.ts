import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SAMPLE_ISLANDS } from "@shared/constants/sample-islands";
import { farmerProfileSchema, productSchema } from "@shared/schemas";
import credits from "./image-credits.json";
import {
  SAMPLE_FARMERS,
  SAMPLE_FEATURED,
  SAMPLE_HERO_IMAGE,
  SAMPLE_LISTINGS,
} from "./data";

const PUBLIC_DIR = join(__dirname, "../../../../public");

describe("sample data", () => {
  it("matches the real domain schemas", () => {
    for (const farmer of SAMPLE_FARMERS) farmerProfileSchema.parse(farmer);
    for (const listing of SAMPLE_LISTINGS) productSchema.parse(listing);
  });

  it("uses unique ids and known islands", () => {
    expect(new Set(SAMPLE_LISTINGS.map((l) => l.id)).size).toBe(
      SAMPLE_LISTINGS.length,
    );
    expect(new Set(SAMPLE_FARMERS.map((f) => f.uid)).size).toBe(
      SAMPLE_FARMERS.length,
    );
    for (const f of SAMPLE_FARMERS) {
      expect(
        SAMPLE_ISLANDS.find((i) => i.id === f.location.islandId)?.atollCode,
      ).toBe(f.location.atollCode);
    }
  });

  it("never uses a real-looking phone number", () => {
    for (const f of SAMPLE_FARMERS) expect(f.contact.phone).toBe("+9600000000");
  });

  it("has a bundled, credited photo for every listing and the hero", () => {
    const paths = [
      ...SAMPLE_LISTINGS.flatMap((l) => l.imagePaths),
      SAMPLE_HERO_IMAGE,
    ];
    for (const path of paths) {
      expect(existsSync(join(PUBLIC_DIR, path)), path).toBe(true);
      const slug = path.replace(/^sample\//, "").replace(/\.jpg$/, "");
      expect(credits, slug).toHaveProperty(slug);
    }
  });

  it("only features existing items", () => {
    const listingIds = new Set(SAMPLE_LISTINGS.map((l) => l.id));
    const farmerIds = new Set(SAMPLE_FARMERS.map((f) => f.uid));
    for (const id of SAMPLE_FEATURED.listingIds)
      expect(listingIds.has(id), id).toBe(true);
    for (const id of SAMPLE_FEATURED.farmerIds)
      expect(farmerIds.has(id), id).toBe(true);
  });
});
