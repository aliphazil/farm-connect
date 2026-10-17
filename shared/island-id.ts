/**
 * Island document ids: "<atoll>-<name-slug>", e.g. "aa-thoddoo". Used by the
 * import script and the admin form, so the same island always gets the same
 * id. Ids never change after creation (records elsewhere point to them).
 * No imports, so Node scripts can load this file directly.
 */
export function slugify(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function islandIdFor(atollCode: string, nameEn: string): string {
  return `${atollCode.toLowerCase()}-${slugify(nameEn)}`;
}
