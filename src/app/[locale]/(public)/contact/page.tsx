import { getDictionary } from "@/i18n/server";
import {
  ContentPage,
  contentMetadata,
} from "@/components/content/content-page";

export const generateMetadata = () => contentMetadata("contact");

export default async function ContactPage() {
  const dict = await getDictionary();
  return (
    <ContentPage
      pageKey="contact"
      related={[
        { path: "/reporting", label: dict.footer.reporting },
        { path: "/help", label: dict.nav.help },
      ]}
    />
  );
}
