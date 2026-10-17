import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Tests that need the Firebase emulators (Security Rules + server services).
 * Run via `npm run test:emulator`, which starts the emulators first.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
      "@shared/": fileURLToPath(new URL("./shared/", import.meta.url)),
      // Server modules import "server-only", which throws outside React Server Components.
      "next/cache": fileURLToPath(
        new URL("./tests/support/next-cache-stub.ts", import.meta.url),
      ),
      "next/headers": fileURLToPath(
        new URL("./tests/support/next-headers-stub.ts", import.meta.url),
      ),
      "next/root-params": fileURLToPath(
        new URL("./tests/support/next-root-params-stub.ts", import.meta.url),
      ),
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only-stub.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // All suites share one emulator; run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    // Browser-SDK config for client services under test (emulators only).
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "fake-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-farmconnect.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-farmconnect",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "demo-farmconnect.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "0",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:0:web:0",
      NEXT_PUBLIC_USE_FIREBASE_EMULATORS: "true",
      // Catalog reads (getListing etc.) come from the emulator, not sample data.
      CATALOG_SOURCE: "firestore",
    },
    hookTimeout: 30_000,
  },
});
