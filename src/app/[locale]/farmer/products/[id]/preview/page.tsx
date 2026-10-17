import { notFound } from "next/navigation";
import { fill } from "@shared/i18n/format";
import { pickLocalized } from "@shared/constants/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerProfile } from "@/services/server/accounts";
import {
  buildProductPreview,
  getFarmerProduct,
  notPublicReason,
} from "@/services/server/farmer";
import { ProductActions } from "@/features/farmer/components/product-actions";
import { ProductDetailView } from "@/components/catalog/product-detail";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ButtonLink } from "@/components/ui/button";

export default async function PreviewProductPage({
  params,
}: PageProps<"/[locale]/farmer/products/[id]/preview">) {
  const user = await requireFarmerPortal();
  const { id } = await params;
  const [locale, dict, product, farm] = await Promise.all([
    getLocale(),
    getDictionary(),
    getFarmerProduct(user.uid, id),
    getFarmerProfile(user.uid),
  ]);
  if (!product || !farm) notFound();

  const t = dict.farmerPortal.preview;
  const reason = notPublicReason(product, farm);
  const reasonText = {
    removed: t.reasonRemoved,
    rejected: t.reasonRejected,
    pending: t.reasonPending,
    draft: t.reasonDraft,
    paused: t.reasonPaused,
    farm: t.reasonFarm,
  };
  const listing = await buildProductPreview(product, farm);
  const title = pickLocalized(product.title, locale);

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          {
            label: dict.farmerPortal.nav.products,
            href: localeHref(locale, "/farmer/products"),
          },
          { label: `${t.title}: ${title}` },
        ]}
      />
      <Alert tone={reason ? "warning" : "success"} title={t.notice}>
        {reason ? `${t.notPublic} ${reasonText[reason]}` : t.isPublic}
        {product.moderationNote ? (
          <span className="mt-1 block">
            {fill(dict.farmerPortal.products.moderationNote, {
              note: product.moderationNote,
            })}
          </span>
        ) : null}
      </Alert>
      <div className="flex flex-wrap items-start gap-3">
        <ProductActions
          productId={product.id}
          title={title}
          status={product.status}
          quantity={product.quantityAvailable}
          locked={product.moderation === "removed"}
          dict={dict}
          locale={locale}
        />
        {reason ? null : (
          <ButtonLink
            href={localeHref(locale, `/products/${product.id}`)}
            variant="ghost"
            size="sm"
          >
            {t.viewLive}
          </ButtonLink>
        )}
      </div>
      <div className="rounded-2xl border border-dashed border-primary/40 p-4 sm:p-6">
        <ProductDetailView
          listing={listing}
          locale={locale}
          dict={dict}
          now={new Date(product.updatedAt)}
          preview
        />
      </div>
    </div>
  );
}
