import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

export default async function NotFound() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  return (
    <Container className="py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-5xl font-bold text-primary">404</p>
        <h1 className="mt-4 text-2xl font-bold">{dict.states.notFoundTitle}</h1>
        <p className="mt-2 text-muted">{dict.states.notFoundBody}</p>
        <ButtonLink href={localeHref(locale)} className="mt-6">
          {dict.states.goHome}
        </ButtonLink>
      </div>
    </Container>
  );
}
