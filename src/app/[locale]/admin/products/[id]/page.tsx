import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { placeText } from "@shared/constants/geography";
import { pickLocalized } from "@shared/constants/locales";
import { formatDate, formatDateTime } from "@shared/utils/date";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { getProductDetail } from "@/services/server/admin-queries";
import { getIslandMap, toPlace } from "@/services/server/farmer";
import { storageObjectUrl } from "@/features/catalog/images";
import { ProductModeration } from "@/features/admin/components/product-moderation";
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

export default async function AdminProductPage({
  params,
}: PageProps<"/[locale]/admin/products/[id]">) {
  const admin = await requireAdminPortal();
  const { id } = await params;
  const [locale, dict, detail, islands] = await Promise.all([
    getLocale(),
    getDictionary(),
    getProductDetail(decodeURIComponent(id)),
    getIslandMap(),
  ]);
  if (!detail) notFound();

  const t = dict.admin;
  const pd = t.productDetail;
  const { product, farmer } = detail;
  const title = pickLocalized(product.title, locale);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={localeHref(locale, "/admin/products")}
        className="text-sm text-primary hover:underline"
      >
        ← {pd.back}
      </Link>
      <PageHeader
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={product.moderation}
              label={t.products.moderationStates[product.moderation]}
            />
            <Badge>{dict.productStatus[product.status]}</Badge>
            <Badge tone={product.isPublic ? "success" : "neutral"}>
              {product.isPublic ? t.products.live : t.products.notLive}
            </Badge>
            {product.featured ? (
              <Badge tone="success">{t.products.featured}</Badge>
            ) : null}
          </span>
        }
      />
      {product.moderationNote ? (
        <Alert tone="warning" title={pd.moderationNote}>
          {product.moderationNote}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {product.imagePaths.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {product.imagePaths.map((path) => (
                <li
                  key={path}
                  className="aspect-square overflow-hidden rounded-lg bg-primary-soft"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail from Storage */}
                  <img
                    src={storageObjectUrl(path)}
                    alt=""
                    className="size-full object-cover"
                  />
                </li>
              ))}
            </ul>
          ) : null}
          <Card>
            <h2 className="mb-2 font-semibold">{pd.details}</h2>
            <dl className="divide-y divide-border">
              <Row label={pd.farmer}>
                {farmer ? (
                  <Link
                    href={localeHref(locale, `/admin/users/${farmer.uid}`)}
                    className="text-primary hover:underline"
                  >
                    {product.farmName
                      ? pickLocalized(product.farmName, locale)
                      : farmer.displayName}
                  </Link>
                ) : (
                  "—"
                )}
              </Row>
              <Row label={pd.category}>{dict.categories[product.category]}</Row>
              <Row label={t.products.price}>
                {formatMVR(product.priceLaari, locale)} /{" "}
                {dict.units[product.unit]}
              </Row>
              <Row label={pd.quantity}>
                {product.quantityAvailable} {dict.units[product.unit]}
              </Row>
              <Row label={pd.location}>
                {placeText(
                  toPlace(
                    islands,
                    product.location.atollCode,
                    product.location.islandId,
                  ),
                  locale,
                )}
              </Row>
              {product.description ? (
                <Row label={dict.products.description}>
                  <span className="whitespace-pre-line">
                    {pickLocalized(product.description, locale)}
                  </span>
                </Row>
              ) : null}
              <Row label={t.products.created}>
                {formatDate(product.createdAt, locale)}
              </Row>
              <Row label={pd.updated}>
                {formatDateTime(product.updatedAt, locale)}
              </Row>
              <Row label="ID">
                <span className="font-mono text-sm">{product.id}</span>
              </Row>
            </dl>
            {product.isPublic ? (
              <Link
                href={localeHref(locale, `/products/${product.id}`)}
                className="mt-3 inline-block text-sm text-primary hover:underline"
              >
                {pd.viewPublic}
              </Link>
            ) : null}
          </Card>

          <section aria-labelledby="reports" className="flex flex-col gap-2">
            <h2 id="reports" className="font-semibold">
              {pd.reports}
            </h2>
            {detail.reports.length ? (
              <ul className="flex flex-col gap-2">
                {detail.reports.map((r) => (
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
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t.userDetail.noReports}</p>
            )}
          </section>

          <section aria-labelledby="history" className="flex flex-col gap-2">
            <h2 id="history" className="font-semibold">
              {pd.history}
            </h2>
            <HistoryList
              entries={detail.history}
              locale={locale}
              empty={t.userDetail.noHistory}
            />
          </section>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start">
          <Card>
            <h2 className="mb-3 font-semibold">{t.userActions.title}</h2>
            <ProductModeration
              productId={product.id}
              moderation={product.moderation}
              status={product.status}
              isPublic={product.isPublic}
              featured={product.featured}
              permissions={LEVEL_PERMISSIONS[admin.adminLevel ?? "moderator"]}
              t={t}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}
