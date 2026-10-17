import { notFound } from "next/navigation";
import { pickLocalized } from "@shared/constants/locales";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import {
  getFarmerProduct,
  getIslandMap,
  listFarmerDeliveryAreas,
} from "@/services/server/farmer";
import { deliveryOptions } from "@/features/farmer/delivery-labels";
import { ProductForm } from "@/features/farmer/components/product-form";
import { inactiveReference } from "@/services/server/reference";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function EditProductPage({
  params,
}: PageProps<"/[locale]/farmer/products/[id]/edit">) {
  const user = await requireFarmerPortal();
  const { id } = await params;
  // Only the farmer's own product is returned; anything else is "not found".
  const [locale, dict, product, areas, islands] = await Promise.all([
    getLocale(),
    getDictionary(),
    getFarmerProduct(user.uid, id),
    listFarmerDeliveryAreas(user.uid),
    getIslandMap(),
  ]);
  if (!product) notFound();
  const t = dict.farmerPortal;

  return (
    <>
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          {
            label: t.nav.products,
            href: localeHref(locale, "/farmer/products"),
          },
          { label: pickLocalized(product.title, locale) },
        ]}
      />
      <PageHeader title={t.form.editTitle} />
      {product.moderation === "removed" ? (
        <Alert tone="error">{t.products.removed}</Alert>
      ) : (
        <ProductForm
          dict={dict}
          locale={locale}
          product={product}
          deliveryOptions={deliveryOptions(areas, islands, locale, dict)}
          inactive={await inactiveReference()}
        />
      )}
    </>
  );
}
