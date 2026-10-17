"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * <details> wrapper for the filter panel: collapsed on phones, opened on
 * large screens (sidebar). Works without JavaScript — it just stays collapsed
 * until tapped.
 */
export function FilterDisclosure({
  summary,
  defaultOpen,
  children,
}: {
  summary: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (ref.current && window.matchMedia("(min-width: 1024px)").matches) {
      ref.current.open = true;
    }
  }, []);

  return (
    <details
      ref={ref}
      open={defaultOpen}
      className="group rounded-xl border border-border bg-surface"
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-semibold [&::-webkit-details-marker]:hidden">
        {summary}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="border-t border-border p-4">{children}</div>
    </details>
  );
}
