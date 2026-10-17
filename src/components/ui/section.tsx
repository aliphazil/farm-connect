import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronIcon } from "./icons";

/** A titled page section with an optional "View all" link. */
export function Section({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: { href: string; label: string };
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      aria-labelledby={headingId}
      className={cn("py-10 sm:py-14", className)}
    >
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id={headingId}
            className="text-xl font-bold tracking-tight sm:text-2xl"
          >
            {title}
          </h2>
          {description ? (
            <p className="mt-1 max-w-2xl text-muted">{description}</p>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-primary hover:underline"
          >
            {action.label}
            <ChevronIcon />
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}
