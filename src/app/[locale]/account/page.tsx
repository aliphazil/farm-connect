import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { getConsumerOverview } from "@/services/server/consumer";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/layout-primitives";

export default async function ConsumerHome() {
  const user = await requireConsumerPortal();
  const [locale, dict, stats] = await Promise.all([
    getLocale(),
    getDictionary(),
    getConsumerOverview(user.uid),
  ]);
  const t = dict.account.overview;
  const n = (v: number | null) =>
    v === null ? "—" : v.toLocaleString("en-US");
  const tiles = [
    {
      label: t.favourites,
      value: stats.favourites,
      href: "/account/favourites",
    },
    {
      label: t.openEnquiries,
      value: stats.openEnquiries,
      href: "/account/enquiries",
    },
    { label: t.invoices, value: stats.invoices, href: "/account/invoices" },
    { label: t.reports, value: stats.openReports, href: "/account/reports" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          <ButtonLink href={localeHref(locale, "/products")}>
            {t.browse}
          </ButtonLink>
        }
      />
      {!user.emailVerified ? (
        <Alert tone="info">{dict.auth.verifyEmail}</Alert>
      ) : null}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.href}>
            <Link
              href={localeHref(locale, tile.href)}
              className="block rounded-xl focus-visible:outline-2"
            >
              <Card className="flex flex-col gap-1 transition hover:border-primary">
                <p className="text-sm text-muted">{tile.label}</p>
                <p className="text-2xl font-bold">{n(tile.value)}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
