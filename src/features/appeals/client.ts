import { getClientAuth } from "@/lib/firebase/client";
import type { MyNotice } from "@/services/server/appeals";

/**
 * Calls /api/appeals with the signed-in Firebase user's ID token. Works for
 * suspended and blocked people too (they have no session cookie).
 */

export type NoticeData = Omit<
  MyNotice,
  "createdAt" | "expiresAt" | "endedAt" | "appeal"
> & {
  createdAt: string | Date;
  expiresAt?: string | Date;
  endedAt?: string | Date;
  appeal: Omit<MyNotice["appeal"], "submittedAt" | "decidedAt"> & {
    submittedAt?: string | Date;
    decidedAt?: string | Date;
  };
};

export class AppealRequestError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const auth = getClientAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new AppealRequestError("signed_out");
  const res = await fetch("/api/appeals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ ...body, idToken: await user.getIdToken() }),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AppealRequestError(json.error ?? "server_error");
  return json;
}

export function fetchMyNotices() {
  return call<{ notices: NoticeData[]; appealsEnabled: boolean }>({
    action: "list",
  });
}

export function sendAppeal(actionId: string, message: string) {
  return call<{ ok: true }>({ action: "submit", actionId, message });
}
