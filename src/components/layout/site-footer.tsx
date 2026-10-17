import Link from "next/link";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const href = (path: string) => localeHref(locale, path);
  const columns = [
    {
      title: dict.footer.marketplace,
      links: [
        { href: href("/products"), label: dict.nav.products },
        { href: href("/categories"), label: dict.nav.categories },
        { href: href("/farmers"), label: dict.nav.farmers },
        { href: href("/locations"), label: dict.nav.locations },
      ],
    },
    {
      title: dict.footer.support,
      links: [
        { href: href("/help"), label: dict.nav.help },
        { href: href("/contact"), label: dict.nav.contact },
        { href: href("/reporting"), label: dict.footer.reporting },
        { href: href("/about"), label: dict.nav.about },
      ],
    },
    {
      title: dict.footer.legal,
      links: [
        { href: href("/terms"), label: dict.footer.terms },
        { href: href("/privacy"), label: dict.footer.privacy },
        { href: href("/credits"), label: dict.footer.credits },
      ],
    },
  ];

  return (
    <footer className="mt-auto border-t border-border bg-surface text-sm">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <p className="text-base font-bold text-primary">
              {dict.meta.siteName}
            </p>
          </div>
          <p className="mt-3 max-w-sm text-muted">{dict.meta.tagline}</p>
          <div className="mt-5 max-w-sm rounded-xl bg-primary-soft p-4">
            <p className="font-semibold">{dict.footer.forFarmers}</p>
            <p className="mt-1 text-muted">{dict.footer.forFarmersBody}</p>
            <ButtonLink
              href={`${href("/register")}#farmer`}
              size="sm"
              className="mt-3"
            >
              {dict.nav.registerFarmer}
            </ButtonLink>
          </div>
        </div>
        <nav aria-label={dict.common.footerNavigation} className="contents">
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="font-semibold">{column.title}</h2>
              <ul className="mt-3 space-y-1">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-block py-1 text-muted underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </Container>
      <div className="border-t border-border">
        <Container className="flex flex-col gap-1 py-5 text-muted sm:flex-row sm:justify-between">
          <p>
            © {dict.meta.siteName}. {dict.footer.rights}
          </p>
          <p>{dict.footer.noOnlinePayments}</p>
        </Container>
      </div>
    </footer>
  );
}
