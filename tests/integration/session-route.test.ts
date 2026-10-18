import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { afterAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getClientAuth } from "@/lib/firebase/client";
import { blockUser, suspendUser } from "@/services/server/admin";
import { completeRegistration } from "@/services/server/registration";
import { POST } from "@/app/api/auth/session/route";

/** The real session endpoint: suspended and blocked accounts get no session. */

const owner = {
  uid: "owner-actor",
  role: "admin",
  adminLevel: "owner" as const,
};
const PASSWORD = "correct-horse-battery";

async function member() {
  const email = `session-${randomUUID()}@example.test`;
  const { uid } = await getAdminAuth().createUser({
    email,
    password: PASSWORD,
  });
  await completeRegistration(uid, email, {
    role: "consumer",
    displayName: "Mariyam",
    preferredLocale: "en",
    acceptTerms: true,
  });
  return { uid, email };
}

async function signInRequest(email: string) {
  await signOut(getClientAuth()).catch(() => undefined);
  const { user } = await signInWithEmailAndPassword(
    getClientAuth(),
    email,
    PASSWORD,
  );
  const idToken = await user.getIdToken(true);
  return POST(
    new Request("http://localhost:3000/api/auth/session", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000",
      },
      body: JSON.stringify({ idToken }),
    }),
  );
}

afterAll(async () => {
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("POST /api/auth/session", () => {
  it("creates a session for an active account", async () => {
    const { email } = await member();
    const res = await signInRequest(email);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("__session=");
  });

  it("refuses a suspended account, and lifts the suspension once it has ended", async () => {
    const { uid, email } = await member();
    await suspendUser(owner, uid, 7, "Investigation");
    const refused = await signInRequest(email);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toEqual({ error: "account_suspended" });

    await getAdminDb()
      .collection(COLLECTIONS.users)
      .doc(uid)
      .update({ suspendedUntil: new Date(Date.now() - 1000) });
    const allowed = await signInRequest(email);
    expect(allowed.status).toBe(200);
    expect(
      (await getAdminDb().collection(COLLECTIONS.users).doc(uid).get()).get(
        "status",
      ),
    ).toBe("active");
  });

  it("refuses a blocked account a session (Firebase sign-in still works, for appeals)", async () => {
    const { uid, email } = await member();
    await blockUser(owner, uid, "Fraud");
    const res = await signInRequest(email);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "account_blocked" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
