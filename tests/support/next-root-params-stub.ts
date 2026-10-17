// Test-only replacement for "next/root-params" (see vitest.emulator.config.mts):
// root params are provided by the Next.js compiler, not available under Vitest.
export const locale = async () => "en";
