"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

type NavItem = { href: string; label: string };
type Props = {
  items: readonly NavItem[];
  menuLabel: string;
  closeLabel: string;
};

/**
 * Disclosure menu for small screens. Closes on Escape and on navigation.
 * Where the pathname is only known at request time, it works without
 * highlighting the current page until the pathname streams in.
 */
export function MobileNav(props: Props) {
  return (
    <Suspense fallback={<Menu {...props} pathname={null} />}>
      <MobileNavWithPath {...props} />
    </Suspense>
  );
}

function MobileNavWithPath(props: Props) {
  return <Menu {...props} pathname={usePathname()} />;
}

function Menu({
  items,
  menuLabel,
  closeLabel,
  pathname,
}: Props & { pathname: string | null }) {
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close when the route changes (adjusting state during render, per React docs).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-border bg-surface"
      >
        <span className="sr-only">{open ? closeLabel : menuLabel}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {open ? (
        <nav
          id="mobile-nav"
          aria-label={menuLabel}
          className="absolute inset-x-0 top-full z-40 border-b border-border bg-surface shadow-md"
        >
          <ul className="flex flex-col p-2">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={pathname === item.href ? "page" : undefined}
                  className="block rounded-lg px-4 py-3 hover:bg-primary-soft aria-[current=page]:font-semibold aria-[current=page]:text-primary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
