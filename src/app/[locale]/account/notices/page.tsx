import { getDictionary, getLocale } from "@/i18n/server";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { listMyNotices } from "@/services/server/appeals";
import { NoticesPanel } from "@/features/appeals/components/notices-panel";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function AccountNoticesPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, data] = await Promise.all([
    getLocale(),
    getDictionary(),
    listMyNotices(user.uid),
  ]);
  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={dict.notices.title} description={dict.notices.intro} />
      <NoticesPanel
        notices={data.notices}
        appealsEnabled={data.appealsEnabled}
        dict={dict}
        locale={locale}
      />
    </div>
  );
}
