// Test-only replacement for "next/cache" (see vitest.emulator.config.mts):
// caching is a Next.js runtime feature, so these are no-ops under Vitest.
export const cacheTag = () => undefined;
export const cacheLife = () => undefined;
export const updateTag = () => undefined;
export const revalidateTag = () => undefined;
export const io = async () => undefined;
