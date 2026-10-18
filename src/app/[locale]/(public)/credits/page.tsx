import type { Metadata } from "next";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { getSampleImageCredits } from "@/features/catalog/queries";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Container, PageHeader } from "@/components/ui/layout-primitives";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.pages.creditsTitle };
}

/** Typefaces the site serves (details: src/fonts/LICENSE.md). */
const FONT_CREDITS = [
  {
    name: "MV Faseyha",
    credit:
      "Calligraphy by Abdulla Waheed, Office of the President; managed by Hassan Shujau; edited by Hassan Hameed (1995). Used with permission.",
  },
  {
    name: "MV Waheed",
    credit:
      "Named after calligrapher Abdulla Waheed; created by Hassan Shujau and Hassan Hameed (1996). Used with permission.",
  },
  {
    name: "Inter",
    credit: "The Inter Project Authors. SIL Open Font License 1.1.",
  },
  {
    name: "Noto Sans Thaana",
    credit: "Google LLC. SIL Open Font License 1.1.",
  },
];

/** Attribution for bundled sample photos, as their CC licences require. */
export default async function CreditsPage() {
  const [locale, dict, credits] = await Promise.all([
    getLocale(),
    getDictionary(),
    getSampleImageCredits(),
  ]);
  return (
    <Container className="py-8">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: dict.nav.home, href: localeHref(locale) },
          { label: dict.pages.creditsTitle },
        ]}
      />
      <PageHeader
        title={dict.pages.creditsTitle}
        description={dict.pages.creditsIntro}
      />
      <ul className="max-w-3xl divide-y divide-border rounded-xl border border-border bg-surface">
        {credits.map((c) => (
          <li
            key={c.slug}
            className="flex flex-col gap-1 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="font-medium" dir="ltr">
              {c.slug}.jpg — {c.author}
            </span>
            <span className="flex gap-3 text-muted" dir="ltr">
              {c.licenseUrl ? (
                <a
                  href={c.licenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  {c.license}
                </a>
              ) : (
                <span>{c.license}</span>
              )}
              <a
                href={c.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {dict.common.source}
                <span className="sr-only"> {dict.common.opensNewTab}</span>
              </a>
            </span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="fonts" className="mt-10 max-w-3xl">
        <h2 id="fonts" className="mb-2 text-xl font-semibold">
          {dict.pages.fontsTitle}
        </h2>
        <p className="mb-4 text-sm text-muted">{dict.pages.fontsIntro}</p>
        <ul
          className="divide-y divide-border rounded-xl border border-border bg-surface text-sm"
          dir="ltr"
        >
          {FONT_CREDITS.map((f) => (
            <li key={f.name} className="flex flex-col gap-1 p-4">
              <span className="font-medium">{f.name}</span>
              <span className="text-muted">{f.credit}</span>
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
