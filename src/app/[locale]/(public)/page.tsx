import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container } from "@/components/ui/layout-primitives";

export default async function HomePage() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const steps = [
    { title: dict.home.how1Title, body: dict.home.how1Body, icon: "🔎" },
    { title: dict.home.how2Title, body: dict.home.how2Body, icon: "📞" },
    { title: dict.home.how3Title, body: dict.home.how3Body, icon: "🚤" },
  ];

  return (
    <>
      <section className="bg-gradient-to-b from-primary-soft to-background">
        <Container className="py-16 sm:py-24">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              {dict.home.heroTitle}
            </h1>
            <p className="mt-4 text-lg text-muted">{dict.home.heroBody}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={localeHref(locale, "/marketplace")} size="lg">
                {dict.home.browseCta}
              </ButtonLink>
              <ButtonLink
                href={localeHref(locale, "/register")}
                size="lg"
                variant="secondary"
              >
                {dict.home.sellCta}
              </ButtonLink>
            </div>
          </div>
        </Container>
      </section>

      <Container className="py-14">
        <h2 className="text-2xl font-bold">{dict.home.howTitle}</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {steps.map((step) => (
            <li key={step.title}>
              <Card className="h-full">
                <span aria-hidden="true" className="text-3xl">
                  {step.icon}
                </span>
                <h3 className="mt-3 font-semibold">{step.title}</h3>
                <p className="mt-1 text-muted">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </Container>
    </>
  );
}
