import Link from "next/link";
import { LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { fill } from "@shared/i18n/format";
import { formatDateTime } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { listPendingAppeals } from "@/services/server/admin-queries";
import { AppealDecision } from "@/features/admin/components/enforcement-actions";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminAppealsPage() {
  const admin = await requireAdminPortal();
  const [locale, dict, appeals] = await Promise.all([
    getLocale(),
    getDictionary(),
    listPendingAppeals(),
  ]);
  const t = dict.admin;
  const a = t.appeals;
  const permissions = LEVEL_PERMISSIONS[admin.adminLevel ?? "moderator"];

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={a.title} description={a.intro} />
      {appeals.length === 0 ? (
        <EmptyState icon="⚖️" title={a.empty} />
      ) : (
        <ul className="flex flex-col gap-3">
          {appeals.map((item) => {
            const canDecide =
              item.userId !== admin.uid &&
              permissions.includes(
                item.type === "block" ? "users.block" : "users.moderate",
              );
            return (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={localeHref(locale, `/admin/users/${item.userId}`)}
                    className="font-semibold text-primary hover:underline"
                  >
                    {item.userName}
                  </Link>
                  <Badge tone="warning">{t.enforcement.types[item.type]}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {a.action}: {item.reason} ·{" "}
                  {formatDateTime(item.createdAt, locale)} ·{" "}
                  {fill(t.enforcement.by, { name: item.createdByName })}
                </p>
                <p className="rounded-lg bg-background p-3 text-sm whitespace-pre-line">
                  <span className="font-medium">{a.appealMessage}:</span>{" "}
                  {item.appeal.message}
                </p>
                <p className="text-xs text-muted">
                  {item.appeal.submittedAt
                    ? fill(a.submitted, {
                        date: formatDateTime(item.appeal.submittedAt, locale),
                      })
                    : ""}
                </p>
                {canDecide ? (
                  <AppealDecision actionId={item.id} t={t} />
                ) : (
                  <p className="text-sm text-muted">{t.errors.forbidden}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
