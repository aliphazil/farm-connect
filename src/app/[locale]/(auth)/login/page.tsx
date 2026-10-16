import type { Metadata } from "next";
import { getDictionary } from "@/i18n/server";
import { Alert } from "@/components/ui/alert";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.auth.signInTitle };
}

// Sign-in form arrives in Phase 2 (Auth & roles).
export default async function LoginPage() {
  const dict = await getDictionary();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{dict.auth.signInTitle}</h1>
      <Alert tone="info">{dict.auth.notReady}</Alert>
    </>
  );
}
