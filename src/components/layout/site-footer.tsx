import Link from "next/link";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import type { SiteConfig } from "@shared/schemas";
import { RichText } from "@/components/content/rich-text";
import { localeHref } from "@/i18n/paths";
import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

export function SiteFooter({
  locale,
  dict,
  config,
}: {
  locale: Locale;
  dict: Dictionary;
  config: SiteConfig;
}) {
  const href = (path: string) => localeHref(locale, path);
  const pick = (t: { en: string; dv: string }) =>
    (locale === "dv" ? t.dv || t.en : t.en || t.dv).trim();
  const f = config.footer;
  const about = pick(f.about);
  const address = pick(f.address);
  const hasContact =
    f.contactEmail || f.contactPhone || address || f.social.length;
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
    <footer className="mt-auto border-t border-border bg-surface text-sm print:hidden">
      <Container className="grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <p className="text-base font-bold text-primary">
              {dict.meta.siteName}
            </p>
          </div>
          <p className="mt-3 max-w-sm text-muted">{dict.meta.tagline}</p>
          {about ? (
            <RichText source={about} className="mt-3 max-w-sm text-muted" />
          ) : null}
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
          {f.links.length ? (
            <div>
              <h2 className="font-semibold">{dict.footer.more}</h2>
              <ul className="mt-3 space-y-1">
                {f.links.map((link) =>
                  link.href.startsWith("/") ? (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-block py-1 text-muted underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {pick(link.label)}
                      </Link>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        rel="noopener noreferrer nofollow"
                        target="_blank"
                        className="inline-block py-1 text-muted underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {pick(link.label)}
                        <span className="sr-only">
                          {" "}
                          {dict.common.opensNewTab}
                        </span>
                      </a>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : null}
        </nav>
        {hasContact ? (
          <div className="flex flex-col gap-2 border-t border-border pt-6 sm:col-span-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 lg:col-span-5">
            <h2 className="font-semibold">{dict.footer.contactTitle}</h2>
            {f.contactEmail ? (
              <a
                href={`mailto:${f.contactEmail}`}
                className="text-muted hover:text-foreground"
              >
                {f.contactEmail}
              </a>
            ) : null}
            {f.contactPhone ? (
              <a
                href={`tel:${f.contactPhone}`}
                className="text-muted hover:text-foreground"
              >
                {f.contactPhone}
              </a>
            ) : null}
            {address ? <span className="text-muted">{address}</span> : null}
            {f.social.length ? (
              <ul
                aria-label={dict.footer.followUs}
                className="flex flex-wrap gap-3"
              >
                {f.social.map((s) => (
                  <li key={s.url}>
                    <a
                      href={s.url}
                      rel="noopener noreferrer nofollow"
                      target="_blank"
                      className="text-primary underline"
                    >
                      {dict.footer.social[s.platform]}
                      <span className="sr-only">
                        {" "}
                        {dict.common.opensNewTab}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
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
