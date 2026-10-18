import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { placeText } from "@shared/constants/geography";
import { LOCALE_LABEL, pickLocalized } from "@shared/constants/locales";
import { fill } from "@shared/i18n/format";
import { formatDate, formatDateTime } from "@shared/utils/date";
import { formatMvPhone } from "@shared/utils/phone";
import type { FraudReport } from "@shared/schemas";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import {
  getModerationSettings,
  getUserDetail,
  listEnforcementFor,
} from "@/services/server/admin-queries";
import { AccountModerationTools } from "@/features/admin/components/enforcement-actions";
import { getIslandMap, toPlace } from "@/services/server/farmer";
import { UserActions } from "@/features/admin/components/user-actions";
import { HistoryList, StatusBadge } from "@/components/admin/admin-ui";
import { Alert } from "@/components/ui/alert";
import { Badge, Card, PageHeader } from "@/components/ui/layout-primitives";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export default async function AdminUserPage({
  params,
}: PageProps<"/[locale]/admin/users/[uid]">) {
  const admin = await requireAdminPortal();
  const { uid } = await params;
  const userId = decodeURIComponent(uid);
  const [locale, dict, detail, islands, enforcement, settings] =
    await Promise.all([
      getLocale(),
      getDictionary(),
      getUserDetail(userId),
      getIslandMap(),
      listEnforcementFor(userId),
      getModerationSettings(),
    ]);
  if (!detail) notFound();

  const t = dict.admin;
  const d = t.userDetail;
  const { user, farm, consumer, auth } = detail;
  const permissions = LEVEL_PERMISSIONS[admin.adminLevel ?? "moderator"];
  const yesNo = (v: boolean | undefined) => (v ? t.common.yes : t.common.no);
  const place = (loc?: { atollCode: string; islandId: string }) =>
    loc
      ? placeText(
          toPlace(islands, loc.atollCode as never, loc.islandId),
          locale,
        )
      : "—";
  const listHref = localeHref(
    locale,
    user.role === "farmer" ? "/admin/farmers" : "/admin/buyers",
  );
  const n = (v: number | null) => (v === null ? "—" : String(v));

  const reportList = (reports: FraudReport[]) =>
    reports.length ? (
      <ul className="flex flex-col gap-2">
        {reports.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-border p-3 text-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">
                {dict.report.reasons[r.reason]}
              </span>
              <StatusBadge
                status={r.status}
                label={dict.reportStatus[r.status]}
              />
              <span className="text-muted">
                {formatDate(r.createdAt, locale)}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-line">{r.details}</p>
            {r.resolution ? (
              <p className="mt-1 text-muted">
                {t.reports.resolution}: {r.resolution}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted">{d.noReports}</p>
    );

  return (
    <div className="flex flex-col gap-6">
      <Link href={listHref} className="text-sm text-primary hover:underline">
        ← {d.back}
      </Link>
      <PageHeader
        title={user.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge>{d.roles[user.role]}</Badge>
            <StatusBadge
              status={user.status}
              label={t.users.statuses[user.status]}
            />
            {farm ? (
              <StatusBadge
                status={farm.approvalStatus}
                label={t.users.approvals[farm.approvalStatus]}
              />
            ) : null}
          </span>
        }
      />

      {user.status !== "active" ? (
        <Alert tone={user.status === "blocked" ? "error" : "warning"}>
          {user.status === "suspended" && user.suspendedUntil ? (
            <p>
              {fill(d.suspendedUntil, {
                date: formatDateTime(user.suspendedUntil, locale),
              })}
            </p>
          ) : null}
          {user.blockedReason ? (
            <p>{fill(d.statusReason, { reason: user.blockedReason })}</p>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-2 font-semibold">{d.profile}</h2>
            <dl className="divide-y divide-border">
              <Row label={d.email}>{user.email ?? "—"}</Row>
              <Row label={d.emailVerified}>{yesNo(auth?.emailVerified)}</Row>
              <Row label={d.phone}>
                {user.phone ? formatMvPhone(user.phone) : "—"}
              </Row>
              <Row label={d.language}>{LOCALE_LABEL[user.preferredLocale]}</Row>
              <Row label={d.location}>{place(user.location)}</Row>
              <Row label={d.joined}>{formatDate(user.createdAt, locale)}</Row>
              <Row label={d.lastSignIn}>
                {auth?.lastSignIn
                  ? formatDateTime(new Date(auth.lastSignIn), locale)
                  : "—"}
              </Row>
              <Row label={d.terms}>
                {user.termsAcceptedAt
                  ? `${formatDate(user.termsAcceptedAt, locale)} (${user.termsVersion ?? ""})`
                  : "—"}
              </Row>
              <Row label={d.restrictions}>
                {user.restrictions?.length
                  ? user.restrictions
                      .map((r) => d.restrictionLabels[r])
                      .join(", ")
                  : d.noRestrictions}
              </Row>
              <Row label="ID">
                <span className="font-mono text-sm">{user.uid}</span>
              </Row>
            </dl>
          </Card>

          {farm ? (
            <Card>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{d.farm}</h2>
                <div className="flex gap-3 text-sm">
                  <Link
                    href={localeHref(
                      locale,
                      `/admin/products?farmer=${user.uid}`,
                    )}
                    className="text-primary hover:underline"
                  >
                    {d.viewListings}
                  </Link>
                  {farm.approvalStatus === "approved" && farm.visible ? (
                    <Link
                      href={localeHref(locale, `/farmers/${user.uid}`)}
                      className="text-primary hover:underline"
                    >
                      {d.publicProfile}
                    </Link>
                  ) : null}
                </div>
              </div>
              <dl className="divide-y divide-border">
                <Row label={d.farmName}>
                  {pickLocalized(farm.farmName, locale)}
                </Row>
                {farm.bio ? (
                  <Row label={d.bio}>{pickLocalized(farm.bio, locale)}</Row>
                ) : null}
                <Row label={d.location}>{place(farm.location)}</Row>
                <Row label={d.farmContact}>
                  {[
                    farm.contact.phone,
                    farm.contact.whatsapp,
                    farm.contact.viber,
                  ]
                    .filter(Boolean)
                    .map((p) => formatMvPhone(p!))
                    .join(" · ")}
                </Row>
                <Row label={d.address}>{farm.address ?? "—"}</Row>
                <Row label={d.mapPin}>
                  {farm.mapLocation
                    ? `${farm.mapLocation.lat}, ${farm.mapLocation.lng}`
                    : "—"}
                </Row>
                <Row label={d.pickup}>{yesNo(farm.pickupAvailable)}</Row>
                <Row label={d.verified}>{yesNo(farm.verified)}</Row>
                <Row label={d.visible}>{yesNo(farm.visible)}</Row>
              </dl>
            </Card>
          ) : null}

          {consumer ? (
            <Card>
              <h2 className="mb-2 font-semibold">{d.buyerProfile}</h2>
              <dl className="divide-y divide-border">
                <Row label={d.preferredIsland}>
                  {place(consumer.defaultDeliveryLocation)}
                </Row>
                <Row label={d.marketing}>{yesNo(consumer.marketingOptIn)}</Row>
              </dl>
            </Card>
          ) : null}

          <Card>
            <h2 className="mb-2 font-semibold">{d.activity}</h2>
            <dl className="divide-y divide-border">
              {user.role === "farmer" ? (
                <>
                  <Row label={d.products}>{n(detail.counts.products)}</Row>
                  <Row label={d.enquiriesReceived}>
                    {n(detail.counts.enquiriesReceived)}
                  </Row>
                </>
              ) : null}
              <Row label={d.enquiriesSent}>
                {n(detail.counts.enquiriesSent)}
              </Row>
            </dl>
          </Card>

          <section
            aria-labelledby="reports-about"
            className="flex flex-col gap-2"
          >
            <h2 id="reports-about" className="font-semibold">
              {d.reportsAbout}
            </h2>
            {reportList(detail.reportsAbout)}
          </section>
          <section aria-labelledby="reports-by" className="flex flex-col gap-2">
            <h2 id="reports-by" className="font-semibold">
              {d.reportsBy}
            </h2>
            {reportList(detail.reportsBy)}
          </section>
          <section
            aria-labelledby="enforcement"
            className="flex flex-col gap-2"
          >
            <h2 id="enforcement" className="font-semibold">
              {t.enforcement.title}
            </h2>
            {enforcement.length ? (
              <ul className="flex flex-col gap-2">
                {enforcement.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {t.enforcement.types[a.type]}
                      </span>
                      <Badge
                        tone={a.status === "active" ? "danger" : "neutral"}
                      >
                        {t.enforcement.statuses[a.status]}
                      </Badge>
                      {a.appeal.status !== "none" ? (
                        <Badge
                          tone={
                            a.appeal.status === "pending"
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {t.enforcement.appealStatuses[a.appeal.status]}
                        </Badge>
                      ) : null}
                      {a.reportId ? (
                        <Link
                          href={localeHref(
                            locale,
                            `/admin/reports/${a.reportId}`,
                          )}
                          className="text-primary hover:underline"
                        >
                          {t.enforcement.fromReport}
                        </Link>
                      ) : null}
                    </div>
                    <p className="mt-1 text-muted">
                      {formatDateTime(a.createdAt, locale)} ·{" "}
                      {fill(t.enforcement.by, { name: a.createdByName })}
                      {a.expiresAt
                        ? ` · ${fill(t.enforcement.until, { date: formatDateTime(a.expiresAt, locale) })}`
                        : ""}
                    </p>
                    <p className="mt-1">{a.reason}</p>
                    {a.restrictions?.length ? (
                      <p className="text-muted">
                        {a.restrictions
                          .map((r) => d.restrictionLabels[r])
                          .join(", ")}
                      </p>
                    ) : null}
                    {a.internalNote ? (
                      <p className="mt-1 text-muted italic">{a.internalNote}</p>
                    ) : null}
                    {a.appeal.heldUntilDecision ? (
                      <p className="text-muted">
                        {fill(t.enforcement.appealHeld, {
                          reason: a.appeal.heldReason ?? "",
                        })}
                      </p>
                    ) : null}
                    {a.appeal.message ? (
                      <p className="mt-1 rounded bg-background p-2 whitespace-pre-line">
                        {t.appeals.appealMessage}: {a.appeal.message}
                      </p>
                    ) : null}
                    {a.appeal.outcomeNote ? (
                      <p className="mt-1 text-muted">{a.appeal.outcomeNote}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.enforcement.none}</p>
            )}
          </section>

          <section aria-labelledby="history" className="flex flex-col gap-2">
            <h2 id="history" className="font-semibold">
              {d.history}
            </h2>
            <HistoryList
              entries={detail.history}
              locale={locale}
              empty={d.noHistory}
            />
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <h2 className="mb-3 font-semibold">{t.userActions.title}</h2>
            {user.role === "admin" ? (
              <p className="text-sm text-muted">{d.adminAccount}</p>
            ) : user.uid === admin.uid ? (
              <p className="text-sm text-muted">
                {t.errors.cannot_target_self}
              </p>
            ) : (
              <UserActions
                uid={user.uid}
                role={user.role}
                status={user.status}
                approval={farm?.approvalStatus}
                restrictions={user.restrictions ?? []}
                permissions={permissions}
                allowAppealHold={settings.allowAppealHold}
                t={t}
              />
            )}
            {user.role !== "admin" && user.uid !== admin.uid ? (
              <div className="mt-4 border-t border-border pt-4">
                <AccountModerationTools
                  uid={user.uid}
                  canWarn={permissions.includes("users.moderate")}
                  canRecord={permissions.includes("reports.manage")}
                  allowAppealHold={settings.allowAppealHold}
                  reasons={dict.report.reasons}
                  t={t}
                />
              </div>
            ) : null}
          </Card>
        </aside>
      </div>
    </div>
  );
}
