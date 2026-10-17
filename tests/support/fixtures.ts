import type { ProductInput } from "@shared/schemas";

export const PROJECT_ID = "demo-farmconnect";

export function emulatorHost(envVar: string): { host: string; port: number } {
  const value = process.env[envVar];
  if (!value)
    throw new Error(
      `${envVar} is not set — run through \`npm run test:emulator\``,
    );
  const [host, port] = value.split(":");
  return { host, port: Number(port) };
}

export const LOCATION_AA = { atollCode: "AA", islandId: "aa-thoddoo" } as const;
export const LOCATION_HDH = {
  atollCode: "HDH",
  islandId: "hdh-hanimaadhoo",
} as const;

export const PRODUCT_INPUT: ProductInput = {
  title: { en: "Papaya", dv: "ފަޅޯ" },
  category: "fruits",
  unit: "kg",
  priceLaari: 2500,
  quantityAvailable: 50,
  imagePaths: [],
  deliveryDestinations: [{ atollCode: "AA" }],
  status: "active",
};
