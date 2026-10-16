"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { isLocale, DEFAULT_LOCALE } from "@shared/constants/locales";
import { dictionaries } from "@shared/i18n";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/layout-primitives";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const params = useParams<{ locale: string }>();
  const dict =
    dictionaries[isLocale(params.locale) ? params.locale : DEFAULT_LOCALE];

  useEffect(() => {
    // Replace with an error-reporting service later.
    console.error(error);
  }, [error]);

  return (
    <Container className="py-16">
      <div role="alert" className="mx-auto max-w-lg text-center">
        <h1 className="text-2xl font-bold">{dict.states.errorTitle}</h1>
        <p className="mt-2 text-muted">{dict.states.errorBody}</p>
        <Button className="mt-6" onClick={() => retry()}>
          {dict.states.tryAgain}
        </Button>
      </div>
    </Container>
  );
}
