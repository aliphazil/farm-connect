import type { MetadataRoute } from "next";

/**
 * Sample-data previews (CATALOG_SOURCE isn't "firestore") ask search engines
 * not to index anything, so fictional farms never appear in search results.
 * The live site keeps private portal pages out of search.
 */
export default function robots(): MetadataRoute.Robots {
  if (process.env.CATALOG_SOURCE !== "firestore")
    return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/en/admin",
        "/dv/admin",
        "/en/farmer",
        "/dv/farmer",
        "/en/account",
        "/dv/account",
        "/en/documents",
        "/dv/documents",
        "/en/preview",
        "/dv/preview",
      ],
    },
  };
}
