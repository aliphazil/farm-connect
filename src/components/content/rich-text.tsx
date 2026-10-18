import Link from "next/link";
import { parseRichText } from "@shared/rich-text";
import { cn } from "@/lib/cn";

/**
 * Renders admin-written rich text (shared/rich-text.ts) as React elements.
 * No HTML is ever injected: text is escaped by React, and links are only
 * internal paths or validated https URLs.
 */
export function RichText({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  const paragraphs = parseRichText(source);
  if (!paragraphs.length) return null;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          {p.map((t, j) =>
            t.type === "break" ? (
              <br key={j} />
            ) : t.type === "bold" ? (
              <strong key={j}>{t.text}</strong>
            ) : t.type === "link" ? (
              t.href.startsWith("/") ? (
                <Link key={j} href={t.href} className="text-primary underline">
                  {t.text}
                </Link>
              ) : (
                <a
                  key={j}
                  href={t.href}
                  rel="noopener noreferrer nofollow"
                  target="_blank"
                  className="text-primary underline"
                >
                  {t.text}
                </a>
              )
            ) : (
              <span key={j}>{t.text}</span>
            ),
          )}
        </p>
      ))}
    </div>
  );
}
