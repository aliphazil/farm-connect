import { describe, expect, it } from "vitest";
import { buildProductCreate, buildReportCreate } from "../payloads";
import { compact, parseDoc } from "../firestore-convert";
import { isProductPublic, productSchema, registrationSchema } from "./index";

const consumer = {
  role: "consumer",
  displayName: "Hassan",
  preferredLocale: "dv",
  acceptTerms: true,
};
const farmer = {
  role: "farmer",
  displayName: "Aisha",
  preferredLocale: "en",
  acceptTerms: true,
  phone: "777 1234",
  farmName: { en: "Thoddoo Fields" },
  location: { atollCode: "AA", islandId: "aa-thoddoo" } as const,
};

describe("registrationSchema", () => {
  it("accepts consumers and farmers", () => {
    expect(registrationSchema.parse(consumer).role).toBe("consumer");
    expect(registrationSchema.parse(farmer)).toMatchObject({
      role: "farmer",
      phone: "+9607771234",
    });
  });

  it("never accepts the admin role", () => {
    expect(
      registrationSchema.safeParse({ ...consumer, role: "admin" }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...farmer, role: "admin" }).success,
    ).toBe(false);
  });

  it("requires farm details for farmers and accepted terms for everyone", () => {
    expect(
      registrationSchema.safeParse({ ...farmer, location: undefined }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...farmer, phone: undefined }).success,
    ).toBe(false);
    expect(
      registrationSchema.safeParse({ ...consumer, acceptTerms: false }).success,
    ).toBe(false);
  });
});

describe("payload builders", () => {
  const farm = {
    location: farmer.location,
    approvalStatus: "pending" as const,
    visible: true,
  };
  const input = {
    title: { en: "Papaya" },
    category: "fruits" as const,
    unit: "kg" as const,
    priceLaari: 2500,
    quantityAvailable: 5,
    imagePaths: [],
    deliveryDestinations: [],
    status: "active" as const,
  };

  it("derive ownership and visibility instead of trusting input", () => {
    const now = "NOW";
    const doc = buildProductCreate(
      { ...input, farmerId: "someone-else" } as never,
      farm,
      "me",
      now,
    );
    expect(doc).toMatchObject({
      farmerId: "me",
      farmerVisible: false,
      moderation: "ok",
      createdAt: now,
    });
    expect(doc).not.toHaveProperty("description");
  });

  it("validate input with the shared schema", () => {
    expect(() =>
      buildProductCreate({ ...input, priceLaari: 0 }, farm, "me", 0),
    ).toThrow();
    expect(() =>
      buildReportCreate(
        {
          targetType: "product",
          targetId: "p",
          reason: "other",
          details: "short",
        },
        "me",
        0,
      ),
    ).toThrow();
  });
});

describe("firestore-convert", () => {
  it("turns Timestamps into Dates and adds the id", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const stamp = { toDate: () => at };
    const parsed = parseDoc(productSchema, "p1", {
      farmerId: "f",
      title: { en: "Papaya" },
      category: "fruits",
      unit: "kg",
      priceLaari: 100,
      quantityAvailable: 1,
      imagePaths: [],
      location: farmer.location,
      deliveryDestinations: [],
      status: "active",
      moderation: "ok",
      farmerVisible: true,
      isPublic: true,
      searchTokens: ["pa", "pap", "papa", "papay", "papaya"],
      deliveryAtolls: [farmer.location.atollCode],
      createdAt: stamp,
      updatedAt: stamp,
    });
    expect(parsed.id).toBe("p1");
    expect(parsed.createdAt).toEqual(at);
    expect(isProductPublic(parsed)).toBe(true);
    expect(isProductPublic({ ...parsed, moderation: "removed" })).toBe(false);
  });

  it("compact drops undefined values recursively", () => {
    expect(compact({ a: 1, b: undefined, c: { d: undefined, e: 2 } })).toEqual({
      a: 1,
      c: { e: 2 },
    });
  });
});
