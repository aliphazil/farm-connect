import { Suspense } from "react";
import type { Locale } from "@shared/constants/locales";
import { ROLE_HOME, type Role } from "@shared/constants/roles";
import type { Dictionary } from "@shared/i18n";
import type { SiteConfig } from "@shared/schemas";
import { storageObjectUrl } from "@/features/catalog/images";
import { localeHref } from "@/i18n/paths";
import { getSessionUser } from "@/lib/auth/session";
import { AccountMenu } from "@/features/auth/components/account-menu";
import { Logo } from "@/components/brand/logo";
import { SearchForm } from "@/components/catalog/search-form";
import { ButtonLink } from "@/components/ui/button";
import { Container, Skeleton } from "@/components/ui/layout-primitives";
import { LocaleSwitcher } from "./locale-switcher";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";

export function SiteHeader({
  locale,
  dict,
  config,
}: {
  locale: Locale;
  dict: Dictionary;
  config: SiteConfig;
}) {
  const href = (path: string) => localeHref(locale, path);
  const mainLinks = [
    { href: href("/products"), label: dict.nav.products },
    { href: href("/categories"), label: dict.nav.categories },
    { href: href("/farmers"), label: dict.nav.farmers },
    { href: href("/locations"), label: dict.nav.locations },
    { href: href("/about"), label: dict.nav.about },
    { href: href("/help"), label: dict.nav.help },
  ];
  const mobileLinks = [
    ...mainLinks,
    { href: href("/contact"), label: dict.nav.contact },
    { href: `${href("/register")}#farmer`, label: dict.nav.registerFarmer },
  ];

  return (
    <header className="relative z-30 border-b border-border bg-surface print:hidden">
      <Container className="flex min-h-16 items-center gap-3 py-2 sm:gap-6">
        <Logo
          href={href("/")}
          name={dict.meta.siteName}
          imageSrc={
            config.identity.logoPath
              ? storageObjectUrl(config.identity.logoPath)
              : undefined
          }
        />

        <SearchForm
          locale={locale}
          dict={dict}
          id="site-search"
          className="hidden max-w-md md:flex"
        />

        <div className="ms-auto flex items-center gap-2">
          {config.languages.enabled.length > 1 ? (
            <LocaleSwitcher
              current={locale}
              label={dict.common.language}
              locales={config.languages.enabled}
            />
          ) : null}
          {/* Reads the session cookie, so it streams in after the static shell. */}
          <Suspense fallback={<Skeleton className="h-11 w-24 rounded-full" />}>
            <HeaderAccount locale={locale} dict={dict} />
          </Suspense>
          <MobileNav
            items={mobileLinks}
            menuLabel={dict.common.menu}
            closeLabel={dict.common.closeMenu}
          />
        </div>
      </Container>

      {/* Search stays visible on phones — it's the main way people find produce. */}
      <Container className="pb-3 md:hidden">
        <SearchForm locale={locale} dict={dict} id="site-search-mobile" />
      </Container>

      <div className="hidden border-t border-border md:block">
        <Container>
          <nav aria-label={dict.common.mainNavigation}>
            <ul className="flex gap-1 py-1.5">
              {mainLinks.map((link) => (
                <li key={link.href}>
                  <NavLink href={link.href}>{link.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
      </div>
    </header>
  );
}

const PORTAL_LABEL: Record<Role, (dict: Dictionary) => string> = {
  farmer: (d) => d.nav.farmerPortal,
  consumer: (d) => d.nav.consumerPortal,
  admin: (d) => d.nav.adminPortal,
};

/** Role-based account area: portal link for the user's own role only. */
async function HeaderAccount({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <ButtonLink
          href={localeHref(locale, "/login")}
          variant="ghost"
          size="sm"
        >
          {dict.nav.signIn}
        </ButtonLink>
        {/* Wrapper handles visibility: ButtonLink's own inline-flex would override "hidden". */}
        <span className="hidden lg:block">
          <ButtonLink
            href={`${localeHref(locale, "/register")}#farmer`}
            size="sm"
          >
            {dict.nav.registerFarmer}
          </ButtonLink>
        </span>
      </div>
    );
  }
  return (
    <AccountMenu
      name={user.name ?? user.email ?? "?"}
      portalHref={localeHref(
        locale,
        user.role ? ROLE_HOME[user.role] : "/onboarding",
      )}
      portalLabel={
        user.role ? PORTAL_LABEL[user.role](dict) : dict.auth.onboardingTitle
      }
      labels={{
        accountMenu: dict.auth.accountMenu,
        signedInAs: dict.auth.signedInAs,
        signOut: dict.auth.signOut,
        signingOut: dict.auth.signingOut,
      }}
      locale={locale}
    />
  );
}
