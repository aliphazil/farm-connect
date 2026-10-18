import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    // Self only: the farm profile's "use my current location" button.
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  // Browsers only honour this over HTTPS (ignored on http://localhost).
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Restrictions that don't need per-request script nonces. A full script
  // CSP is a follow-up (see docs/security.md).
  {
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  // Fonts read at runtime by the invoice/receipt PDF routes.
  outputFileTracingIncludes: {
    "/api/invoices/[id]/pdf": ["./src/lib/pdf/fonts/**"],
    "/api/receipts/[id]/pdf": ["./src/lib/pdf/fonts/**"],
  },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      // Listing photos and branding assets served from Firebase Storage.
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      // Phase 1 URL, renamed to /products.
      {
        source: "/:locale(en|dv)/marketplace",
        destination: "/:locale/products",
        permanent: true,
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
