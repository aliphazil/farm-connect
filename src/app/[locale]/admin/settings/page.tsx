import { ADMIN_PERMISSIONS, LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { fill } from "@shared/i18n/format";
import { getDictionary } from "@/i18n/server";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import { getModerationSettings } from "@/services/server/admin-queries";
import { ApprovalToggle } from "@/features/admin/components/settings-actions";
import { Badge, Card, PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminSettingsPage() {
  const { user, allowed } = await requireAdminPermission("settings.manage");
  const [dict, settings] = await Promise.all([
    getDictionary(),
    getModerationSettings(),
  ]);
  const t = dict.admin;
  const s = t.settings;
  const level = user.adminLevel ?? "moderator";
  const mine = LEVEL_PERMISSIONS[level];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={s.title} description={s.intro} />

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{s.approval}</h2>
        <p className="text-sm text-muted">{s.approvalHelp}</p>
        <p className="font-medium">
          {settings.listingsRequireApproval ? s.approvalOn : s.approvalOff}
        </p>
        {allowed ? (
          <ApprovalToggle enabled={settings.listingsRequireApproval} t={t} />
        ) : (
          <p className="text-sm text-muted">{t.common.ownerOnly}</p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{s.access}</h2>
        <p className="text-sm text-muted">{s.accessHelp}</p>
        <p>
          <Badge tone="success">
            {fill(t.common.yourLevel, { level: t.common.levels[level] })}
          </Badge>
        </p>
        <h3 className="mt-2 text-sm font-semibold">{s.yourAccess}</h3>
        <ul className="flex flex-col gap-1.5 text-sm">
          {ADMIN_PERMISSIONS.map((p) => (
            <li key={p} className="flex items-start gap-2">
              <span aria-hidden="true">{mine.includes(p) ? "✓" : "–"}</span>
              <span
                className={
                  mine.includes(p) ? undefined : "text-muted line-through"
                }
              >
                {
                  s.permissions[
                    p.replace(".", "_") as keyof typeof s.permissions
                  ]
                }
                <span className="sr-only">
                  {mine.includes(p)
                    ? ` (${t.common.yes})`
                    : ` (${t.common.no})`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
