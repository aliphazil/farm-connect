import { getDictionary } from "@/i18n/server";
import {
  ContentPage,
  contentMetadata,
} from "@/components/content/content-page";

export const generateMetadata = () => contentMetadata("help");

export default async function HelpPage() {
  const dict = await getDictionary();
  return (
    <ContentPage
      pageKey="help"
      related={[
        { path: "/contact", label: dict.nav.contact },
        { path: "/reporting", label: dict.footer.reporting },
      ]}
    />
  );
}
