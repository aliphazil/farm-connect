import { getDictionary, getLocale, getSiteConfig } from "@/i18n/server";
import {
  catalogNow,
  getAtollSummaries,
  getCategoryCounts,
  getFeaturedFarmers,
  getFeaturedListings,
  getRecentListings,
  isSampleCatalog,
} from "@/features/catalog/queries";
import { HomeContent } from "@/components/home/home-content";

export default async function HomePage() {
  const [locale, dict, config] = await Promise.all([
    getLocale(),
    getDictionary(),
    getSiteConfig(),
  ]);
  const [featured, recent, farmers, atolls, counts] = await Promise.all([
    getFeaturedListings(),
    getRecentListings(4),
    getFeaturedFarmers(),
    getAtollSummaries(),
    getCategoryCounts(),
  ]);
  return (
    <HomeContent
      locale={locale}
      dict={dict}
      config={config}
      data={{
        featured,
        recent,
        farmers,
        atolls,
        counts,
        now: await catalogNow(),
        isSample: isSampleCatalog,
      }}
    />
  );
}
