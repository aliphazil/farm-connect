import {
  PRODUCT_CATEGORIES,
  type ProductCategory,
} from "@shared/constants/catalog";

export { CATEGORY_ICON } from "@shared/constants/catalog";

/** URL slugs use hyphens: "leafy_greens" ↔ "leafy-greens". */
export function categoryToSlug(category: ProductCategory): string {
  return category.replace(/_/g, "-");
}

export function slugToCategory(slug: string): ProductCategory | undefined {
  const value = slug.replace(/-/g, "_");
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value)
    ? (value as ProductCategory)
    : undefined;
}
