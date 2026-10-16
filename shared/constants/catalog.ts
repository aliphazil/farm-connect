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
  "dozen",
  "bag",
  "box",
  "litre",
] as const;
export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const LISTING_STATUSES = [
  "draft",
  "active",
  "paused",
  "sold_out",
  "removed",
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const MAX_LISTING_IMAGES = 6;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
