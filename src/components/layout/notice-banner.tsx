import Link from "next/link";
import type { Locale } from "@shared/constants/locales";
import type { Dictionary } from "@shared/i18n";
import { localeHref } from "@/i18n/paths";
import { hasActiveNotice } from "@/services/server/appeals";
import { Alert } from "@/components/ui/alert";

/** Tells a signed-in user there's a warning or restriction on their account. */
export async function NoticeBanner({
  uid,
  dict,
  locale,
}: {
  uid: string;
  dict: Dictionary;
  locale: Locale;
}) {
  if (!(await hasActiveNotice(uid).catch(() => false))) return null;
  return (
    <Alert tone="warning">
      {dict.notices.banner}{" "}
      <Link
        href={localeHref(locale, "/account/notices")}
        className="font-medium underline"
      >
        {dict.notices.bannerLink}
      </Link>
    </Alert>
  );
}
