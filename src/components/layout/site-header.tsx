import Link from "next/link";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

export function SiteHeader({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const links = [
    { href: localeHref(locale, "/marketplace"), label: dict.nav.marketplace },
    { href: localeHref(locale, "/login"), label: dict.nav.signIn },
    { href: localeHref(locale, "/register"), label: dict.nav.register },
  ];

  return (
    <header className="relative border-b border-border bg-surface">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <Link
          href={localeHref(locale)}
          className="flex items-center gap-2 text-lg font-bold text-primary"
        >
          <span aria-hidden="true">🌱</span>
          {dict.meta.siteName}
        </Link>

        <nav
          aria-label={dict.common.mainNavigation}
          className="hidden items-center gap-1 md:flex"
        >
          <NavLink href={links[0].href}>{links[0].label}</NavLink>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher current={locale} label={dict.common.language} />
          <div className="hidden items-center gap-2 md:flex">
            <ButtonLink href={links[1].href} variant="ghost" size="sm">
              {dict.nav.signIn}
            </ButtonLink>
            <ButtonLink href={links[2].href} size="sm">
              {dict.nav.register}
            </ButtonLink>
          </div>
          <MobileNav
            items={links}
            menuLabel={dict.common.menu}
            closeLabel={dict.common.closeMenu}
          />
        </div>
      </Container>
    </header>
  );
}
