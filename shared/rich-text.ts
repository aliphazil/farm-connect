/**
 * The only "rich text" admins can write: paragraphs (blank line between),
 * line breaks, **bold**, and [links](https://example.com or /en/page).
 * It is parsed into plain tokens and rendered as React elements, so no HTML
 * from the editor ever reaches the page. Anything else is shown as text.
 */

export type RichToken =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "break" };

export type RichParagraph = RichToken[];

/** An internal path like "/en/products" (not "//host", no backslashes). */
export function isInternalPath(href: string): boolean {
  return /^\/[A-Za-z0-9\-._~/?#=&%]*$/.test(href) && !href.startsWith("//");
}

/**
 * A safe external link: https only, a real host name, no credentials, no
 * whitespace or control characters. Returns the normalised URL or null.
 */
export function safeExternalUrl(href: string): string | null {
  if (href.length > 500 || /[\s<>"'`]/.test(href)) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null;
  return url.toString();
}

/** An href that's either internal or a safe external https URL. */
export function safeHref(href: string): string | null {
  const trimmed = href.trim();
  if (isInternalPath(trimmed)) return trimmed;
  return safeExternalUrl(trimmed);
}

const LINK = /\[([^\]\n]{1,120})\]\(([^)\s]{1,500})\)/;
const BOLD = /\*\*([^*\n]{1,200})\*\*/;

function parseInline(line: string): RichToken[] {
  const out: RichToken[] = [];
  let rest = line;
  while (rest.length) {
    const link = LINK.exec(rest);
    const bold = BOLD.exec(rest);
    const next = [link, bold]
      .filter((m): m is RegExpExecArray => m !== null)
      .sort((a, b) => a.index - b.index)[0];
    if (!next) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (next.index > 0)
      out.push({ type: "text", text: rest.slice(0, next.index) });
    if (next === link) {
      const href = safeHref(next[2]);
      // Unsafe links (javascript:, data:, http:…) are kept as plain text.
      out.push(
        href
          ? { type: "link", text: next[1], href }
          : { type: "text", text: next[0] },
      );
    } else out.push({ type: "bold", text: next[1] });
    rest = rest.slice(next.index + next[0].length);
  }
  return out;
}

export function parseRichText(source: string): RichParagraph[] {
  return source
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) =>
      p
        .split("\n")
        .flatMap((line, i) => [
          ...(i > 0 ? [{ type: "break" } as RichToken] : []),
          ...parseInline(line),
        ]),
    );
}

/** Links in the text that aren't safe (for editor validation messages). */
export function unsafeLinks(source: string): string[] {
  const bad: string[] = [];
  const re = new RegExp(LINK.source, "g");
  for (const m of source.matchAll(re)) if (!safeHref(m[2])) bad.push(m[2]);
  return bad;
}
