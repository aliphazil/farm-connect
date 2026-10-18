import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { listFarmerProducts } from "@/services/server/farmer";
import { getEnquiryForSale } from "@/services/server/finance-queries";
import { OrderForm } from "@/features/finance/components/finance-forms";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function NewSalePage({
  searchParams,
}: PageProps<"/[locale]/farmer/sales/new">) {
  const user = await requireFarmerPortal();
  const [locale, dict, params, products] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
    listFarmerProducts(user.uid),
  ]);
  const t = dict.sales;
  const enquiryId =
    typeof params.enquiry === "string"
      ? params.enquiry.slice(0, 128)
      : undefined;
  const enquiry = enquiryId
    ? await getEnquiryForSale(user.uid, enquiryId)
    : null;
  const notAccepted =
    enquiry && !["accepted", "completed"].includes(enquiry.status);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        label={dict.common.breadcrumb}
        items={[
          { label: t.title, href: localeHref(locale, "/farmer/sales") },
          { label: t.newTitle },
        ]}
      />
      <PageHeader title={t.newTitle} />
      {notAccepted ? (
        <Alert tone="warning">{t.errors.enquiry_not_accepted}</Alert>
      ) : (
        <OrderForm
          products={products
            .filter((p) => p.moderation !== "removed")
            .map((p) => ({
              id: p.id,
              title: p.title,
              unit: p.unit,
              priceLaari: p.priceLaari,
            }))}
          enquiry={
            enquiry
              ? {
                  id: enquiry.id,
                  buyerName: enquiry.consumerName ?? t.buyer,
                  productId: enquiry.product?.id,
                  quantity: enquiry.quantity,
                }
              : null
          }
          dict={dict}
          locale={locale}
        />
      )}
    </div>
  );
}
