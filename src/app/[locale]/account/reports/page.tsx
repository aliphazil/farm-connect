import { pickLocalized } from "@shared/constants/locales";
import { formatDate } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { listConsumerReports } from "@/services/server/consumer";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

const STATUS_TONE = {
  open: "warning",
  reviewing: "warning",
  resolved: "success",
  dismissed: "neutral",
} as const;

export default async function MyReportsPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, reports] = await Promise.all([
    getLocale(),
    getDictionary(),
    listConsumerReports(user.uid),
  ]);
  const t = dict.account.reports;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={t.intro} />
      {reports.length === 0 ? (
        <EmptyState icon="🛡️" title={t.empty} description={t.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {dict.report.reasons[r.reason]}
                </h2>
                <Badge tone={STATUS_TONE[r.status]}>
                  {dict.reportStatus[r.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted">
                {t.target}:{" "}
                {r.targetLabel
                  ? pickLocalized(r.targetLabel, locale)
                  : r.targetId}{" "}
                · {formatDate(r.createdAt, locale)}
              </p>
              <p className="text-sm whitespace-pre-line">{r.details}</p>
              {r.resolution ? (
                <p className="rounded-lg bg-background p-3 text-sm">
                  <span className="font-medium">{t.resolution}:</span>{" "}
                  {r.resolution}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
