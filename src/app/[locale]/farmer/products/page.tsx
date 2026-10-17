import Link from "next/link";
import { fill } from "@shared/i18n/format";
import { pickLocalized } from "@shared/constants/locales";
import { isFarmPublic } from "@shared/schemas";
import { formatMVR } from "@shared/utils/money";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerProfile } from "@/services/server/accounts";
import { listFarmerProducts } from "@/services/server/farmer";
import { storageObjectUrl } from "@/features/catalog/images";
import { ProductActions } from "@/features/farmer/components/product-actions";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, PageHeader } from "@/components/ui/layout-primitives";

const STATUS_TONE = {
  active: "success",
  draft: "neutral",
  paused: "warning",
  sold_out: "warning",
} as const;

export default async function FarmerProductsPage({
  searchParams,
}: PageProps<"/[locale]/farmer/products">) {
  const user = await requireFarmerPortal();
  const [locale, dict, products, farm, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    listFarmerProducts(user.uid),
    getFarmerProfile(user.uid),
    searchParams,
  ]);
  const t = dict.farmerPortal.products;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t.title}
        description={t.intro}
        actions={
          <ButtonLink href={localeHref(locale, "/farmer/products/new")}>
            {t.add}
          </ButtonLink>
        }
      />
      {params.saved ? <Alert tone="success">{t.saved}</Alert> : null}
      {farm && !isFarmPublic(farm) && products.length > 0 ? (
        <Alert tone="info">{t.notPublicHint}</Alert>
      ) : null}

      {products.length === 0 ? (
        <EmptyState
          icon="🌱"
          title={t.empty}
          description={t.emptyBody}
          action={
            <ButtonLink href={localeHref(locale, "/farmer/products/new")}>
              {t.add}
            </ButtonLink>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {products.map((p) => {
            const title = pickLocalized(p.title, locale);
            const removed = p.moderation === "removed";
            return (
              <li
                key={p.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row"
              >
                <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-primary-soft">
                  {p.imagePaths[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small thumbnail from Storage
                    <img
                      src={storageObjectUrl(p.imagePaths[0])}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={localeHref(
                        locale,
                        `/farmer/products/${p.id}/preview`,
                      )}
                      className="truncate font-semibold text-primary hover:underline"
                    >
                      {title}
                    </Link>
                    {removed ? (
                      <Badge tone="danger">{t.removed}</Badge>
                    ) : p.moderation === "rejected" ? (
                      <Badge tone="danger">{t.rejected}</Badge>
                    ) : p.moderation === "pending" ? (
                      <Badge tone="warning">{t.pending}</Badge>
                    ) : (
                      <Badge tone={STATUS_TONE[p.status]}>
                        {dict.productStatus[p.status]}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    <span className="sr-only">{t.price}: </span>
                    {formatMVR(p.priceLaari, locale)} / {dict.units[p.unit]} ·{" "}
                    <span className="sr-only">{t.quantity}: </span>
                    {p.quantityAvailable} {dict.units[p.unit]}
                  </p>
                  {p.moderationNote ? (
                    <p className="text-sm text-danger">
                      {fill(t.moderationNote, { note: p.moderationNote })}
                    </p>
                  ) : null}
                  <ProductActions
                    productId={p.id}
                    title={title}
                    status={p.status}
                    quantity={p.quantityAvailable}
                    locked={removed}
                    dict={dict}
                    locale={locale}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
