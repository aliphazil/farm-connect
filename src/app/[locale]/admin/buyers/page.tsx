import { getDictionary, getLocale } from "@/i18n/server";
import { requireAdminPortal } from "@/lib/auth/portal-access";
import { UsersList } from "@/components/admin/users-list";

export default async function AdminBuyersPage({
  searchParams,
}: PageProps<"/[locale]/admin/buyers">) {
  await requireAdminPortal();
  const [locale, dict, params] = await Promise.all([
    getLocale(),
    getDictionary(),
    searchParams,
  ]);
  return (
    <UsersList role="consumer" params={params} locale={locale} dict={dict} />
  );
}
