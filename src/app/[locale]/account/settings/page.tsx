import { getDictionary, getLocale } from "@/i18n/server";
import { requireConsumerPortal } from "@/lib/auth/portal-access";
import { getConsumerProfile, getUserAccount } from "@/services/server/accounts";
import { SettingsForm } from "@/features/consumer/components/settings-form";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/layout-primitives";

export default async function AccountSettingsPage() {
  const user = await requireConsumerPortal();
  const [locale, dict, account, consumer] = await Promise.all([
    getLocale(),
    getDictionary(),
    getUserAccount(user.uid),
    getConsumerProfile(user.uid),
  ]);
  const t = dict.account.settings;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t.title} description={t.intro} />
      {account ? (
        <SettingsForm
          account={{
            displayName: account.displayName,
            email: account.email ?? user.email,
            phone: account.phone,
            preferredLocale: account.preferredLocale,
          }}
          consumer={
            consumer
              ? {
                  defaultDeliveryLocation: consumer.defaultDeliveryLocation,
                  marketingOptIn: consumer.marketingOptIn,
                }
              : null
          }
          dict={dict}
          locale={locale}
        />
      ) : (
        <Alert tone="error">{dict.states.errorBody}</Alert>
      )}
    </div>
  );
}
