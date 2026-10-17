"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Locale } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { signOut } from "../client";

/** Signed-in header control: who you are, your portal, and sign out. */
export function AccountMenu({
  name,
  portalHref,
  portalLabel,
  labels,
  locale,
}: {
  name: string;
  portalHref: string | null;
  portalLabel: string;
  /** Only the strings this menu needs (keeps the page payload small). */
  labels: {
    accountMenu: string;
    signedInAs: string;
    signOut: string;
    signingOut: string;
  };
  locale: Locale;
}) {
  const ref = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  // Close on Escape or a click outside.
  useEffect(() => {
    const close = (event: Event) => {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event instanceof MouseEvent && details.contains(event.target as Node))
        return;
      details.open = false;
    };
    document.addEventListener("keydown", close);
    document.addEventListener("click", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("click", close);
    };
  }, []);

  async function onSignOut() {
    setPending(true);
    try {
      await signOut();
    } finally {
      router.replace(`/${locale}`);
      router.refresh();
    }
  }

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={labels.accountMenu}
        className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface ps-1 pe-3 [&::-webkit-details-marker]:hidden"
      >
        <span
          aria-hidden="true"
          className="flex size-8 items-center justify-center rounded-full bg-primary font-semibold text-white"
        >
          {initial}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:block">
          {name}
        </span>
      </summary>
      <div className="absolute end-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg">
        <p className="truncate px-3 py-2 text-sm text-muted">
          {fill(labels.signedInAs, { name })}
        </p>
        {portalHref ? (
          <Link
            href={portalHref}
            className="block rounded-lg px-3 py-2.5 font-medium hover:bg-primary-soft"
          >
            {portalLabel}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onSignOut}
          disabled={pending}
          className="block w-full rounded-lg px-3 py-2.5 text-start font-medium text-danger hover:bg-danger/5 disabled:opacity-60"
        >
          {pending ? labels.signingOut : labels.signOut}
        </button>
      </div>
    </details>
  );
}
