import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { pickLocalized } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { formatDateTime } from "@shared/utils/date";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import {
  getModerationSettings,
  getReportDetail,
} from "@/services/server/admin-queries";
import {
  AddNoteForm,
  AssignControl,
  DecisionForm,
  ReviewControls,
} from "@/features/admin/components/report-workflow";
import { HistoryList, StatusBadge } from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Badge, Card, PageHeader } from "@/components/ui/layout-primitives";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function AdminReportPage({
  params,
}: PageProps<"/[locale]/admin/reports/[id]">) {
  const admin = await requireAdminPortal();
  const { id } = await params;
  const [locale, dict, detail, settings] = await Promise.all([
    getLocale(),
    getDictionary(),
    getReportDetail(decodeURIComponent(id)),
    getModerationSettings(),
  ]);
  if (!detail) notFound();

  const t = dict.admin;
  const r = t.reports;
  const { report } = detail;
  const closed = report.status === "resolved" || report.status === "dismissed";
  const permissions = LEVEL_PERMISSIONS[admin.adminLevel ?? "moderator"];
  const canManage = permissions.includes("reports.manage");
  const userLink = (uid: string, name: string) => (
    <Link
      href={localeHref(locale, `/admin/users/${uid}`)}
      className="text-primary hover:underline"
    >
      {name}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={localeHref(locale, "/admin/reports")}
        className="text-sm text-primary hover:underline"
      >
        ← {r.back}
      </Link>
      <PageHeader
        title={dict.report.reasons[report.reason]}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={report.status}
              label={dict.reportStatus[report.status]}
            />
            <Badge>{r.targetTypes[report.targetType]}</Badge>
            {report.internal ? (
              <Badge tone="warning">{r.internalRecord}</Badge>
            ) : null}
          </span>
        }
      />
      {report.resolution ? (
        <Alert tone={closed ? "success" : "info"} title={r.resolution}>
          {report.resolution}
          {report.outcome ? ` (${r.outcomes[report.outcome]})` : ""}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <dl className="divide-y divide-border">
              <Row label={r.reporter}>
                {userLink(detail.reporter.uid, detail.reporter.name)}{" "}
                <span className="text-sm text-muted">
                  (
                  {
                    r.reporterRoles[
                      (report.reporterRole ??
                        detail.reporter.role ??
                        "consumer") as "consumer"
                    ]
                  }
                  )
                </span>
              </Row>
              <Row label={r.subject}>
                {detail.reportedUser ? (
                  <>
                    {userLink(
                      detail.reportedUser.uid,
                      detail.reportedUser.name,
                    )}{" "}
                    {detail.reportedUser.status ? (
                      <StatusBadge
                        status={detail.reportedUser.status}
                        label={
                          t.users.statuses[
                            detail.reportedUser.status as "active"
                          ] ?? detail.reportedUser.status
                        }
                      />
                    ) : null}
                  </>
                ) : (
                  "—"
                )}
              </Row>
              {detail.product ? (
                <Row label={r.listing}>
                  <Link
                    href={localeHref(
                      locale,
                      `/admin/products/${detail.product.id}`,
                    )}
                    className="text-primary hover:underline"
                  >
                    {pickLocalized(detail.product.title, locale)}
                  </Link>
                </Row>
              ) : null}
              {detail.enquiry ? (
                <Row label={r.enquiry}>
                  {detail.enquiry.quantity} ·{" "}
                  {dict.enquiryStatus[detail.enquiry.status as "new"]} ·{" "}
                  {formatDateTime(detail.enquiry.createdAt, locale)}
                  {detail.enquiry.message ? (
                    <span className="mt-1 block text-sm whitespace-pre-line text-muted">
                      {detail.enquiry.message}
                    </span>
                  ) : null}
                </Row>
              ) : null}
              <Row label={r.received}>
                {formatDateTime(report.createdAt, locale)}
              </Row>
              <Row label={r.assignee}>
                {detail.assigneeName ?? r.unassigned}
              </Row>
            </dl>
            <p className="mt-3 rounded-lg bg-background p-3 text-sm whitespace-pre-line">
              {report.details}
            </p>
          </Card>

          <section aria-labelledby="evidence" className="flex flex-col gap-2">
            <h2 id="evidence" className="font-semibold">
              {r.evidence}
            </h2>
            {report.evidencePaths?.length ? (
              <ul className="flex flex-wrap gap-3">
                {report.evidencePaths.map((_, i) => (
                  <li key={i}>
                    <a
                      href={`/api/admin/report-evidence?report=${report.id}&i=${i}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary underline"
                    >
                      {fill(r.evidenceFile, { n: i + 1 })}
                      <span className="sr-only">
                        {" "}
                        {dict.common.opensNewTab}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{r.noEvidence}</p>
            )}
          </section>

          <section aria-labelledby="messages" className="flex flex-col gap-2">
            <h2 id="messages" className="font-semibold">
              {r.messages}
            </h2>
            {detail.messages.length ? (
              <ol className="flex flex-col gap-2">
                {detail.messages.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-lg p-3 text-sm ${m.author === "admin" ? "bg-primary-soft" : "bg-background"}`}
                  >
                    <p className="font-medium">
                      {m.author === "admin"
                        ? `${r.fromAdmin} (${m.authorName})`
                        : r.fromReporter}{" "}
                      <span className="font-normal text-muted">
                        · {formatDateTime(m.createdAt, locale)}
                      </span>
                    </p>
                    <p className="whitespace-pre-line">{m.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{r.noMessages}</p>
            )}
          </section>

          <section aria-labelledby="notes" className="flex flex-col gap-2">
            <h2 id="notes" className="font-semibold">
              {r.notes}
            </h2>
            <p className="text-sm text-muted">{r.notesHint}</p>
            {detail.notes.length ? (
              <ol className="flex flex-col gap-2">
                {detail.notes.map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <p className="text-muted">
                      {n.authorName} · {formatDateTime(n.createdAt, locale)}
                    </p>
                    <p className="whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{r.noNotes}</p>
            )}
            {canManage ? <AddNoteForm reportId={report.id} t={t} /> : null}
          </section>

          <section aria-labelledby="history" className="flex flex-col gap-2">
            <h2 id="history" className="font-semibold">
              {t.userDetail.history}
            </h2>
            <HistoryList
              entries={detail.history}
              locale={locale}
              empty={t.userDetail.noHistory}
            />
          </section>
        </div>

        {canManage ? (
          <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="flex flex-col gap-3">
              <h2 className="font-semibold">{r.assignee}</h2>
              <AssignControl
                reportId={report.id}
                assigneeId={report.assigneeId ?? null}
                me={admin.uid}
                admins={detail.admins}
                t={t}
              />
            </Card>
            <Card className="flex flex-col gap-3">
              <h2 className="font-semibold">{t.userActions.title}</h2>
              <ReviewControls
                reportId={report.id}
                status={report.status}
                internal={report.internal === true}
                t={t}
              />
            </Card>
            {!closed ? (
              <Card className="flex flex-col gap-3">
                <h2 className="font-semibold">{r.decision}</h2>
                <DecisionForm
                  reportId={report.id}
                  hasReportedUser={!!detail.reportedUser}
                  hasProduct={!!detail.product}
                  permissions={permissions}
                  allowAppealHold={settings.allowAppealHold}
                  t={t}
                />
              </Card>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
