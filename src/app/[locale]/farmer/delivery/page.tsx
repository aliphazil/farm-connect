import Link from "next/link";
import { notFound } from "next/navigation";
import { placeText } from "@shared/constants/geography";
import { getDictionary, getLocale } from "@/i18n/server";
import { localeHref } from "@/i18n/paths";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerProfile } from "@/services/server/accounts";
import {
  getIslandMap,
  listFarmerDeliveryAreas,
  toPlace,
} from "@/services/server/farmer";
import { areaLabel } from "@/features/farmer/delivery-labels";
import { DeliveryManager } from "@/features/farmer/components/delivery-manager";
import { PinIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function FarmerDeliveryPage() {
  const user = await requireFarmerPortal();
  const [locale, dict, farm, areas, islands] = await Promise.all([
    getLocale(),
    getDictionary(),
    getFarmerProfile(user.uid),
    listFarmerDeliveryAreas(user.uid),
    getIslandMap(),
  ]);
  if (!farm) notFound();
  const t = dict.farmerPortal.delivery;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.intro} />
      <section
        aria-labelledby="farm-location"
        className="rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="farm-location" className="font-semibold">
          {t.farmLocation}
        </h2>
        <p className="mt-1 flex items-center gap-2">
          <PinIcon className="size-4 text-primary" />
          {placeText(
            toPlace(islands, farm.location.atollCode, farm.location.islandId),
            locale,
          )}
        </p>
        <Link
          href={localeHref(locale, "/farmer/profile")}
          className="mt-1 inline-block text-sm text-primary underline"
        >
          {t.changeInProfile}
        </Link>
      </section>
      <DeliveryManager
        areas={areas.map((a) => ({
          id: a.id,
          label: areaLabel(a, islands, locale, dict),
          atollCode: a.atollCode,
          islandId: a.islandId,
          method: a.method,
          feeLaari: a.feeLaari,
          minOrderLaari: a.minOrderLaari,
          notes: a.notes,
          active: a.active,
        }))}
        pickupAvailable={farm.pickupAvailable}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
