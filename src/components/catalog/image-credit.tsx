import type { Dictionary } from "@shared/i18n";
import { fill } from "@shared/i18n/format";
import type { ImageCredit as Credit } from "@/features/catalog/types";

/** Attribution line required by the photo's licence (CC BY / BY-SA). */
export function ImageCredit({
  credit,
  dict,
}: {
  credit?: Credit;
  dict: Dictionary;
}) {
  if (!credit) return null;
  return (
    <p className="mt-2 text-xs text-muted">
      {fill(dict.common.photoCredit, {
        author: credit.author,
        license: credit.license,
      })}{" "}
      ·{" "}
      <a
        href={credit.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2"
      >
        {dict.common.source}
        <span className="sr-only"> {dict.common.opensNewTab}</span>
      </a>
    </p>
  );
}
