/**
 * Fills {placeholders} in a dictionary string.
 * fill("{count} products", { count: 3 }) → "3 products".
 * Unknown placeholders are left as-is so missing values are easy to spot.
 */
export function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match,
  );
}
