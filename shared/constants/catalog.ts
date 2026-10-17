/** Product categories. Labels live in the i18n dictionaries under `categories`. */
export const PRODUCT_CATEGORIES = [
  "vegetables",
  "leafy_greens",
  "fruits",
  "root_crops",
  "herbs_spices",
  "coconut_products",
  "eggs",
  "poultry",
  "fish",
  "plants_seedlings",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Selling units. Labels live in the i18n dictionaries under `units`. */
export const PRODUCT_UNITS = [
  "kg",
  "g",
  "piece",
  "bunch",
  "bundle",
  "dozen",
  "bag",
  "box",
  "litre",
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const MAX_LISTING_IMAGES = 6;

/** How a farmer gets produce to a buyer's island. Labels: `deliveryMethods` in the dictionaries. */
export const DELIVERY_METHODS = [
  "ferry",
  "speedboat",
  "cargo_boat",
  "own_vessel",
  "courier",
  "other",
] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

/** Version of the marketplace terms users accept at registration. */
export const TERMS_VERSION = "2026-10-draft";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Decorative icon for each category (hidden from screen readers where used). */
export const CATEGORY_ICON: Record<ProductCategory, string> = {
  vegetables: "🍆",
  leafy_greens: "🥬",
  fruits: "🥭",
  root_crops: "🍠",
  herbs_spices: "🌿",
  coconut_products: "🥥",
  eggs: "🥚",
  poultry: "🐓",
  fish: "🐟",
  plants_seedlings: "🌱",
  other: "🧺",
};
