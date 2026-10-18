import Link from "next/link";
import { fill } from "@shared/i18n/format";
import { formatDateTime } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import {
  getDraft,
  getPublishedState,
  listVersions,
} from "@/services/server/branding";
import { BrandingEditor } from "@/features/admin/components/branding-editor";
import { RestoreVersionButton } from "@/features/admin/components/branding-publish";
import { NotAllowed } from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Card, PageHeader } from "@/components/ui/layout-primitives";

export default async function BrandingStudioPage() {
  const { allowed } = await requireAdminPermission("branding.manage");
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  const t = dict.admin.branding;
  if (!allowed)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={t.title} description={t.intro} />
        <NotAllowed t={dict.admin} />
      </div>
    );

  const [published, draft, versions] = await Promise.all([
    getPublishedState(),
    getDraft(),
    listVersions(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          <Link
            href={localeHref(locale)}
            target="_blank"
            rel="noopener"
            className="text-sm text-primary underline"
          >
            {t.actions.viewLive}
            <span className="sr-only"> {dict.common.opensNewTab}</span>
          </Link>
        }
      />
      <Alert tone={draft ? "warning" : "info"}>
        <p>
          {published.version && published.publishedAt
            ? fill(t.status.published, {
                version: published.version,
                date: formatDateTime(published.publishedAt, locale),
              })
            : t.status.neverPublished}
        </p>
        <p>
          {draft
            ? fill(t.status.draft, {
                date: draft.updatedAt
                  ? formatDateTime(draft.updatedAt, locale)
                  : "",
              })
            : t.status.noDraft}
        </p>
      </Alert>

      <BrandingEditor
        key={
          draft?.updatedAt?.getTime() ?? `published-${published.version ?? 0}`
        }
        initial={draft?.config ?? published.config}
        locale={locale}
        dict={dict}
      />

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t.history.title}</h2>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">{t.history.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {versions.map((v) => (
              <li
                key={v.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {fill(t.history.version, { number: v.number })}
                    {v.number === published.version ? " ✓" : ""}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDateTime(v.publishedAt, locale)}
                    {v.note ? ` · ${v.note}` : ""}
                  </p>
                </div>
                <RestoreVersionButton versionId={v.id} t={dict.admin} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
