/**
 * Prefix search tokens for Firestore `array-contains` queries.
 *
 * Firestore has no full-text search. We store, on each product, the
 * lower-cased word prefixes (2–15 characters) of its English and Dhivehi
 * names; a search for "papa" or "ފަޅ" then matches with one indexed query.
 * It does NOT handle typos, synonyms or relevance ranking — see
 * docs/search.md for when to move to a dedicated search service.
 */

export const MIN_TOKEN = 2;
export const MAX_TOKEN = 15;
export const MAX_TOKENS = 80;

/** Lower-case, strip Latin accents ("Malé" → "male"); Thaana is kept as-is. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
}

/** Words of letters/digits in any script (Latin, Thaana, …). */
export function words(text: string): string[] {
  return normalizeText(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/** All prefixes of every word, for storing on a document. */
export function searchTokens(...texts: (string | undefined)[]): string[] {
  const tokens = new Set<string>();
  for (const word of texts.flatMap((t) => (t ? words(t) : []))) {
    const chars = [...word]; // code points, so Thaana isn't split mid-character
    for (let n = MIN_TOKEN; n <= Math.min(chars.length, MAX_TOKEN); n++) {
      tokens.add(chars.slice(0, n).join(""));
    }
  }
  return [...tokens].slice(0, MAX_TOKENS);
}

/**
 * Picks the token to query by (the longest word, truncated) and the remaining
 * words, which are checked in memory against the matched documents.
 */
export function queryTokens(query: string): {
  primary: string | null;
  rest: string[];
} {
  const all = words(query).filter((w) => [...w].length >= MIN_TOKEN);
  if (!all.length) return { primary: null, rest: [] };
  const sorted = [...all].sort((a, b) => [...b].length - [...a].length);
  const primary = [...sorted[0]].slice(0, MAX_TOKEN).join("");
  return {
    primary,
    rest: sorted.slice(1).map((w) => [...w].slice(0, MAX_TOKEN).join("")),
  };
}
