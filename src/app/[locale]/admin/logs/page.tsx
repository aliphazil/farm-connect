import { formatDateTime } from "@shared/utils/date";
import { ADMIN_LOG_ACTIONS } from "@shared/schemas";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPermission } from "@/lib/auth/portal-access";
import { listAdminLogs } from "@/services/server/admin-queries";
import {
  FilterBar,
  FilterSelect,
  NotAllowed,
  Pager,
  oneOf,
  param,
  withQuery,
} from "@/components/admin/admin-ui";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function AdminLogsPage({
  searchParams,
}: PageProps<"/[locale]/admin/logs">) {
  const { allowed } = await requireAdminPermission("logs.view");
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  const t = dict.admin;
  const l = t.logs;
  if (!allowed)
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={l.title} description={l.intro} />
        <NotAllowed t={t} />
      </div>
    );

  const path = localeHref(locale, "/admin/logs");
  const action = oneOf(param(params, "action"), ADMIN_LOG_ACTIONS);
  const after = param(params, "after");
  const result = await listAdminLogs({ action, after });

  return (
    <div className="flex flex-col gap-2">
      <PageHeader title={l.title} description={l.intro} />
      <FilterBar action={path} clearHref={path} t={t}>
        <FilterSelect
          name="action"
          label={l.action}
          value={action}
          allLabel={t.common.all}
          options={ADMIN_LOG_ACTIONS.map((a) => ({ value: a, label: a }))}
        />
      </FilterBar>
      {result.items.length === 0 ? (
        <EmptyState icon="📜" title={t.common.noResults} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">{l.title}</caption>
            <thead className="border-b border-border">
              <tr>
                {[l.when, l.action, l.actor, l.target, l.details].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="px-3 py-2 text-start font-medium text-muted"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.items.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border align-top last:border-0"
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    {formatDateTime(e.createdAt, locale)}
                  </td>
                  <td className="px-3 py-2 font-mono">{e.action}</td>
                  <td className="px-3 py-2">{e.actorName}</td>
                  <td className="px-3 py-2">
                    <span className="text-muted">{e.targetType}</span>{" "}
                    <span className="font-mono break-all">{e.targetId}</span>
                  </td>
                  <td className="px-3 py-2 break-words text-muted">
                    {e.details
                      ? Object.entries(e.details)
                          .map(
                            ([k, v]) =>
                              `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`,
                          )
                          .join(" · ")
                      : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager
        hrefFor={(cursor) => withQuery(path, { action, after: cursor })}
        after={after}
        nextCursor={result.nextCursor}
        t={t}
      />
    </div>
  );
}
