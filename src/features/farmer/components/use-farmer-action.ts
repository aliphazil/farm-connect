"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authErrorKey } from "@/features/auth/errors";
import { refreshCatalogAction } from "../actions";

/**
 * Runs a farmer write (browser SDK → Security Rules), then refreshes the
 * public catalog cache and re-renders server data. Tracks pending/error.
 */
/** `sessionExpiredMessage` is shown when the browser is no longer signed in. */
export function useFarmerAction(sessionExpiredMessage?: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(
    work: () => Promise<unknown>,
    failureMessage: string,
  ): Promise<boolean> {
    setPending(true);
    setError(null);
    try {
      await work();
      await refreshCatalogAction().catch(() => undefined);
      router.refresh();
      return true;
    } catch (err) {
      console.error(err);
      setError(
        sessionExpiredMessage && authErrorKey(err) === "sessionExpired"
          ? sessionExpiredMessage
          : failureMessage,
      );
      return false;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error, setError };
}
