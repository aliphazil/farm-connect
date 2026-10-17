import { getDictionary, getLocale } from "@/i18n/server";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { UsersList } from "@/components/admin/users-list";

export default async function AdminFarmersPage({
  searchParams,
}: PageProps<"/[locale]/admin/farmers">) {
  await requireAdminPortal();
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  return (
    <UsersList role="farmer" params={params} locale={locale} dict={dict} />
  );
}
