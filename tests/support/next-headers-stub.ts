// Test-only replacement for "next/headers" (see vitest.emulator.config.mts):
// lets tests call Server Actions with a chosen session cookie.
const jar = new Map<string, string>();

export function setTestCookie(name: string, value: string | null) {
  if (value === null) jar.delete(name);
  else jar.set(name, value);
}

export async function cookies() {
  return {
    get: (name: string) =>
      jar.has(name) ? { name, value: jar.get(name)! } : undefined,
  };
}

export async function headers() {
  return new Headers();
}
