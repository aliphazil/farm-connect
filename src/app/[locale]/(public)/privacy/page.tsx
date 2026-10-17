import { getDictionary } from "@/i18n/server";
import {
  ContentPage,
  contentMetadata,
} from "@/components/content/content-page";

export const generateMetadata = () => contentMetadata("privacy");

export default async function PrivacyPage() {
  const dict = await getDictionary();
  return (
    <ContentPage
      pageKey="privacy"
      related={[
        { path: "/terms", label: dict.footer.terms },
        { path: "/contact", label: dict.nav.contact },
      ]}
    />
  );
}
