import { getDictionary } from "@/i18n/server";
import {
  ContentPage,
  contentMetadata,
} from "@/components/content/content-page";

export const generateMetadata = () => contentMetadata("reporting");

export default async function ReportingPage() {
  const dict = await getDictionary();
  return (
    <ContentPage
      pageKey="reporting"
      related={[
        { path: "/help", label: dict.nav.help },
        { path: "/contact", label: dict.nav.contact },
      ]}
    />
  );
}
