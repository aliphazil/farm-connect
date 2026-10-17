import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import {
  getIslandMap,
  listFarmerDeliveryAreas,
} from "@/services/server/farmer";
import { deliveryOptions } from "@/features/farmer/delivery-labels";
import { ProductForm } from "@/features/farmer/components/product-form";
import { inactiveReference } from "@/services/server/reference";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/layout-primitives";
import { Alert } from "@/components/ui/alert";
import { getUserAccount } from "@/services/server/accounts";

export default async function NewProductPage() {
  const user = await requireFarmerPortal();
  const [locale, dict, areas, islands, account] = await Promise.all([
    getLocale(),
    getDictionary(),
    listFarmerDeliveryAreas(user.uid),
    getIslandMap(),
    getUserAccount(user.uid),
  ]);
  return (
    <>
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          {
            label: dict.farmerPortal.nav.products,
            href: localeHref(locale, "/farmer/products"),
          },
          { label: dict.farmerPortal.form.newTitle },
        ]}
      />
      <PageHeader title={dict.farmerPortal.form.newTitle} />
      {account?.restrictions?.includes("listings") ? (
        <Alert tone="warning" className="mb-4">
          {dict.restrictionNotices.listings}
        </Alert>
      ) : null}
      <ProductForm
        dict={dict}
        locale={locale}
        deliveryOptions={deliveryOptions(areas, islands, locale, dict)}
        inactive={await inactiveReference()}
      />
    </>
  );
}
