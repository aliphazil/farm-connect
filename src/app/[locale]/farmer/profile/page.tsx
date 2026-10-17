import { notFound } from "next/navigation";
import { getDictionary, getLocale } from "@/i18n/server";
import { requireFarmerPortal } from "@/lib/auth/portal-access";
import { getFarmerProfile, getUserAccount } from "@/services/server/accounts";
import { FarmProfileForm } from "@/features/farmer/components/farm-profile-form";
import { FarmStatus } from "@/features/farmer/components/farm-status";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function FarmProfilePage({
  searchParams,
}: PageProps<"/[locale]/farmer/profile">) {
  const user = await requireFarmerPortal();
  const [locale, dict, farm, account, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    getFarmerProfile(user.uid),
    getUserAccount(user.uid),
    searchParams,
  ]);
  if (!farm) notFound();
  const t = dict.farmerPortal.profile;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t.title} description={t.intro} />
      {params.welcome ? <Alert tone="success">{t.welcome}</Alert> : null}
      <FarmStatus farm={farm} dict={dict} />
      <FarmProfileForm
        farm={farm}
        fullName={account?.displayName ?? user.name ?? ""}
        email={user.email}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
