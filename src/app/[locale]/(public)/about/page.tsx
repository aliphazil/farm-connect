import { getDictionary } from "@/i18n/server";
import {
  ContentPage,
  contentMetadata,
} from "@/components/content/content-page";

export const generateMetadata = () => contentMetadata("about");

export default async function AboutPage() {
  const dict = await getDictionary();
  return (
    <ContentPage
      pageKey="about"
      related={[
        { path: "/products", label: dict.nav.products },
        { path: "/register#farmer", label: dict.nav.registerFarmer },
        { path: "/help", label: dict.nav.help },
      ]}
    />
  );
}
