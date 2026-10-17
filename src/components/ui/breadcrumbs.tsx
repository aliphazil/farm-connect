import Link from "next/link";
import { ChevronIcon } from "./icons";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({
  items,
  label,
}: {
  items: readonly Crumb[];
  label: string;
}) {
  return (
    <nav aria-label={label} className="mb-4 text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link
                  href={item.href}
                  className="underline-offset-4 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "text-foreground" : undefined}
                >
                  {item.label}
                </span>
              )}
              {!last ? <ChevronIcon className="size-3.5" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
