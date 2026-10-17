import { getDictionary } from "@/i18n/server";
import {
  ContentPage,
  contentMetadata,
} from "@/components/content/content-page";

export const generateMetadata = () => contentMetadata("terms");

export default async function TermsPage() {
  const dict = await getDictionary();
  return (
    <ContentPage
      pageKey="terms"
      related={[
        { path: "/privacy", label: dict.footer.privacy },
        { path: "/reporting", label: dict.footer.reporting },
      ]}
    />
  );
}
