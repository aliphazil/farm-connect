"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { getClientAuth } from "@/lib/firebase/client";
import { signOut } from "@/features/auth/client";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { fetchMyNotices, type NoticeData } from "../client";
import { NoticeList } from "./notice-list";

type CenterState =
  | { kind: "loading" }
  | { kind: "signed_out" }
  | { kind: "error" }
  | { kind: "ready"; notices: NoticeData[]; appealsEnabled: boolean };

async function loadState(): Promise<CenterState> {
  const auth = getClientAuth();
  await auth.authStateReady();
  if (!auth.currentUser) return { kind: "signed_out" };
  try {
    return { kind: "ready", ...(await fetchMyNotices()) };
  } catch {
    return { kind: "error" };
  }
}

/**
 * For people whose account is suspended or blocked: they're signed in to
 * Firebase in this browser but have no session, so notices and appeals are
 * loaded with their ID token.
 */
export function AppealCenter({
  dict,
  locale,
}: {
  dict: Dictionary;
  locale: Locale;
}) {
  const t = dict.appealPage;
  const [reload, setReload] = useState(0);
  const [state, setState] = useState<CenterState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    void loadState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  if (state.kind === "loading")
    return (
      <p className="flex items-center gap-2 text-muted">
        <Spinner label={t.loading} /> {t.loading}
      </p>
    );
  if (state.kind === "signed_out")
    return (
      <div className="flex flex-col gap-3">
        <p>{t.signIn}</p>
        <Link
          href={localeHref(locale, "/login")}
          className={buttonClasses("primary", "md", "self-start")}
        >
          {dict.auth.signInTitle}
        </Link>
      </div>
    );
  if (state.kind === "error") return <Alert tone="error">{t.failed}</Alert>;

  return (
    <div className="flex flex-col gap-4">
      <NoticeList
        notices={state.notices}
        appealsEnabled={state.appealsEnabled}
        dict={dict}
        locale={locale}
        onChanged={() => setReload((n) => n + 1)}
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href={localeHref(locale, "/contact")}
          className={buttonClasses("secondary", "md")}
        >
          {t.contact}
        </Link>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut().catch(() => undefined);
            window.location.assign(localeHref(locale));
          }}
        >
          {t.signOut}
        </Button>
      </div>
    </div>
  );
}
