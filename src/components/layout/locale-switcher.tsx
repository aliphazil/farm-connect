"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { LOCALE_LABEL, LOCALES, type Locale } from "@shared/constants/locales";
import { cn } from "@/lib/cn";
import { LOCALE_COOKIE, switchLocalePath } from "@/i18n/paths";

type Props = { current: Locale; label: string };

/**
 * Links to the same page in each language and remembers the choice.
 * The pathname is runtime data on some routes (e.g. the 404 catch-all), so the
 * fallback links to each locale's home page until it streams in.
 */
export function LocaleSwitcher(props: Props) {
  return (
    <Suspense fallback={<LocaleLinks {...props} pathname={null} />}>
      <LocaleSwitcherWithPath {...props} />
    </Suspense>
  );
}

function LocaleSwitcherWithPath(props: Props) {
  return <LocaleLinks {...props} pathname={usePathname()} />;
}

function LocaleLinks({
  current,
  label,
  pathname,
}: Props & { pathname: string | null }) {
  return (
    <nav aria-label={label} className="flex items-center gap-1 text-sm">
      {LOCALES.map((locale) => (
        <Link
          key={locale}
          href={pathname ? switchLocalePath(pathname, locale) : `/${locale}`}
          hrefLang={locale}
          lang={locale}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => {
            document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={cn(
            "rounded-md px-2 py-1",
            locale === current
              ? "bg-primary-soft font-semibold text-primary"
              : "text-muted hover:text-foreground",
          )}
        >
          {LOCALE_LABEL[locale]}
        </Link>
      ))}
    </nav>
  );
}
