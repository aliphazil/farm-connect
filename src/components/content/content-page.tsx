import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { CONTENT, type ContentPageKey } from "@/content/pages";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container } from "@/components/ui/layout-primitives";

export async function contentMetadata(key: ContentPageKey): Promise<Metadata> {
  const page = CONTENT[key][await getLocale()];
  return { title: page.title, description: page.intro };
}

/** Renders a long-form page from src/content/pages.ts. */
export async function ContentPage({
  pageKey,
  related,
}: {
  pageKey: ContentPageKey;
  /** Links shown after the content, e.g. to related help pages. */
  related?: { path: string; label: string }[];
}) {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const page = CONTENT[pageKey][locale];

  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          { label: page.title },
        ]}
      />
      <article className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {page.title}
        </h1>
        <p className="mt-3 text-lg text-muted">{page.intro}</p>
        {page.draft ? (
          <Alert tone="warning" className="mt-6">
            {dict.pages.draftNotice}
          </Alert>
        ) : null}
        <div className="mt-8 space-y-8">
          {page.sections.map((section) => (
            <Prose key={section.heading} heading={section.heading}>
              {section.paragraphs?.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-2 ps-5 marker:text-primary">
                  {section.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </Prose>
          ))}
        </div>
        {related?.length ? (
          <ul className="mt-10 flex flex-wrap gap-3 border-t border-border pt-6">
            {related.map((link) => (
              <li key={link.path}>
                <Link
                  href={localeHref(locale, link.path)}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-4 font-medium text-primary hover:border-primary hover:bg-primary-soft"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </Container>
  );
}

function Prose({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold">{heading}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}
