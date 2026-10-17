import Link from "next/link";
import { buttonClasses } from "./button";
import { ChevronIcon } from "./icons";

/**
 * Previous / next pagination. `hrefFor(page)` builds each page's URL so
 * current filters are preserved.
 */
export function Pagination({
  page,
  pageCount,
  hrefFor,
  labels,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
  labels: { nav: string; previous: string; next: string; status: string };
}) {
  if (pageCount <= 1) return null;
  return (
    <nav
      aria-label={labels.nav}
      className="mt-8 flex items-center justify-between gap-4"
    >
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          className={buttonClasses("secondary", "md")}
        >
          <ChevronIcon className="size-4 rotate-180" />
          {labels.previous}
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted">{labels.status}</p>
      {page < pageCount ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          className={buttonClasses("secondary", "md")}
        >
          {labels.next}
          <ChevronIcon />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
