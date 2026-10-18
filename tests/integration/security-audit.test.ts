import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { afterAll, describe, expect, it } from "vitest";
import { LEVEL_PERMISSIONS } from "@shared/constants/admin";
import { COLLECTIONS } from "@shared/firestore-paths";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { getClientAuth } from "@/lib/firebase/client";
import { col, InvalidIdError, isDocId } from "@/services/server/db";
import * as adminActions from "@/features/admin/actions";
import * as farmerActions from "@/features/farmer/actions";
import * as financeActions from "@/features/finance/actions";
import * as reportActions from "@/features/reports/actions";
import { GET as invoicePdf } from "@/app/api/invoices/[id]/pdf/route";
import { GET as receiptPdf } from "@/app/api/receipts/[id]/pdf/route";
import { GET as paymentProof } from "@/app/api/payment-proof/route";
import { GET as reportEvidence } from "@/app/api/admin/report-evidence/route";
import { POST as appeals } from "@/app/api/appeals/route";
import { POST as register } from "@/app/api/auth/register/route";
import { setTestCookie } from "../support/next-headers-stub";

/**
 * Pre-launch authorization sweep (Prompt 11). Every exported Server Action is
 * called as each kind of user it must refuse, and every protected API route
 * without a session. Actions are public endpoints: anyone can call them
 * with any arguments, so each must reject before touching data.
 */

const PASSWORD = "correct-horse-battery";
type Fn = (...args: unknown[]) => Promise<unknown>;

async function sessionFor(claims: Record<string, unknown> | null) {
  if (!claims) {
    setTestCookie("__session", null);
    return null;
  }
  const email = `audit-${randomUUID()}@example.test`;
  const { uid } = await getAdminAuth().createUser({
    email,
    password: PASSWORD,
  });
  await getAdminAuth().setCustomUserClaims(uid, claims);
  await getAdminDb()
    .collection(COLLECTIONS.users)
    .doc(uid)
    .set({ role: claims.role, status: "active", displayName: "Audit" });
  await signOut(getClientAuth()).catch(() => undefined);
  const { user } = await signInWithEmailAndPassword(
    getClientAuth(),
    email,
    PASSWORD,
  );
  setTestCookie(
    "__session",
    await getAdminAuth().createSessionCookie(await user.getIdToken(true), {
      expiresIn: 3600_000,
    }),
  );
  return uid;
}

/** Calls an action with junk arguments; true if it refused as unauthorized. */
async function refused(fn: Fn): Promise<boolean> {
  try {
    const result = (await fn("audit-id", { amountLaari: 1 }, "audit")) as {
      ok?: boolean;
      error?: string;
    };
    return result?.ok === false && result.error === "unauthorized";
  } catch (error) {
    return (error as Error)?.name === "AuthorizationError";
  }
}

const actions = (mod: Record<string, unknown>) =>
  Object.entries(mod).filter(
    (e): e is [string, Fn] =>
      typeof e[1] === "function" && e[0].endsWith("Action"),
  );

// Map each admin action to the permission it requires, from the source, so
// new actions are covered automatically.
const adminSource = readFileSync("src/features/admin/actions.ts", "utf8");
function permissionOf(name: string): string {
  const body = adminSource.split(`export async function ${name}(`)[1] ?? "";
  const end = body.indexOf("\nexport ");
  const chunk = end === -1 ? body : body.slice(0, end);
  const permission = /\brun\(\s*"([a-z.]+)"/.exec(chunk)?.[1];
  if (permission) return permission;
  return chunk.includes("return runBranding(") ? "branding.manage" : "unknown";
}

afterAll(async () => {
  setTestCookie("__session", null);
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("Server Actions refuse callers without the right role", () => {
  const all = {
    admin: actions(adminActions),
    farmer: actions(farmerActions),
    finance: actions(financeActions),
    report: actions(reportActions),
  };

  it("finds every action and knows each admin permission", () => {
    expect(all.admin.length).toBeGreaterThanOrEqual(30);
    for (const [name] of all.admin)
      expect(permissionOf(name), name).not.toBe("unknown");
  });

  it("signed-out callers are refused by every action", async () => {
    await sessionFor(null);
    const allowed: string[] = [];
    for (const [name, fn] of Object.values(all).flat())
      if (!(await refused(fn))) allowed.push(name);
    expect(allowed).toEqual([]);
  });

  it("buyers can't use admin, farmer or finance actions", async () => {
    await sessionFor({ role: "consumer" });
    const allowed: string[] = [];
    for (const [name, fn] of [...all.admin, ...all.farmer, ...all.finance])
      if (!(await refused(fn))) allowed.push(name);
    expect(allowed).toEqual([]);
  });

  it("farmers can't use admin actions", async () => {
    await sessionFor({ role: "farmer" });
    const allowed: string[] = [];
    for (const [name, fn] of all.admin)
      if (!(await refused(fn))) allowed.push(name);
    expect(allowed).toEqual([]);
  });

  it("admins can't record farmer finances or file reports as members", async () => {
    await sessionFor({ role: "admin", adminLevel: "owner" });
    const allowed: string[] = [];
    for (const [name, fn] of [...all.finance, ...all.report, ...all.farmer])
      if (!(await refused(fn))) allowed.push(name);
    expect(allowed).toEqual([]);
  });

  it("moderators are refused every owner-only action", async () => {
    await sessionFor({ role: "admin", adminLevel: "moderator" });
    const moderator = LEVEL_PERMISSIONS.moderator as readonly string[];
    const ownerOnly = all.admin.filter(
      ([name]) => !moderator.includes(permissionOf(name)),
    );
    expect(ownerOnly.map(([n]) => n)).toEqual(
      expect.arrayContaining([
        "blockUserAction",
        "changeRoleAction",
        "verifyPaymentAction",
        "publishBrandingAction",
        "setModerationSettingsAction",
      ]),
    );
    const allowed: string[] = [];
    for (const [name, fn] of ownerOnly)
      if (!(await refused(fn))) allowed.push(name);
    expect(allowed).toEqual([]);
  });

  it("a blocked admin claim is refused like no session", async () => {
    await sessionFor({ role: "admin", adminLevel: "owner", blocked: true });
    expect(await refused(adminActions.blockUserAction as Fn)).toBe(true);
    expect(await refused(adminActions.publishBrandingAction as Fn)).toBe(true);
  });
});

describe("protected API routes", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("refuse requests without a session", async () => {
    await sessionFor(null);
    const req = (path: string) => new Request(`http://localhost:3000${path}`);
    expect(
      (await invoicePdf(req("/api/invoices/x/pdf"), params("x"))).status,
    ).toBe(401);
    expect(
      (await receiptPdf(req("/api/receipts/x/pdf"), params("x"))).status,
    ).toBe(401);
    expect(
      (await paymentProof(req("/api/payment-proof?payment=x"))).status,
    ).toBe(401);
    expect(
      (await reportEvidence(req("/api/admin/report-evidence?report=x&i=0")))
        .status,
    ).toBe(403);
  });

  it("refuse other signed-in people's documents without revealing they exist", async () => {
    await sessionFor({ role: "consumer" });
    const invoice = await getAdminDb()
      .collection(COLLECTIONS.invoices)
      .add({ farmerId: "someone-else", status: "issued", totalLaari: 100 });
    const res = await invoicePdf(
      new Request(`http://localhost:3000/api/invoices/${invoice.id}/pdf`),
      params(invoice.id),
    );
    expect(res.status).toBe(404);
    await invoice.delete();
    // Evidence is admin-only, even for signed-in members.
    expect(
      (
        await reportEvidence(
          new Request(
            "http://localhost:3000/api/admin/report-evidence?report=x&i=0",
          ),
        )
      ).status,
    ).toBe(403);
  });

  it("token-authenticated routes reject missing or forged tokens", async () => {
    const post = (body: unknown) =>
      new Request("http://localhost:3000/api/x", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          host: "localhost:3000",
        },
        body: JSON.stringify(body),
      });
    expect((await appeals(post({ action: "list" }))).status).toBe(400);
    expect(
      (await appeals(post({ action: "list", idToken: "x".repeat(40) }))).status,
    ).toBe(401);
    expect(
      (
        await register(
          post({ idToken: "x".repeat(40), profile: { role: "admin" } }),
        )
      ).status,
    ).toBe(401);
  });
});

describe("document ids from requests", () => {
  it("can't reach another path through a crafted id", async () => {
    for (const bad of ["a/b", "x/notes/y", ".", "..", "__x__", ""])
      expect(isDocId(bad), bad).toBe(false);
    expect(isDocId("Ab3-_x")).toBe(true);
    expect(() => col(COLLECTIONS.invoices).doc("x/notes/y")).toThrow(
      InvalidIdError,
    );
    expect(col(COLLECTIONS.invoices).doc().id).toMatch(/^[A-Za-z0-9]{20}$/);

    // Through a real route: a signed-in user asking for a nested path gets
    // no document.
    await sessionFor({ role: "consumer" });
    const res = await invoicePdf(
      new Request("http://localhost:3000/api/invoices/x%2Fy%2Fz/pdf"),
      { params: Promise.resolve({ id: "x/y/z" }) },
    );
    expect(res.status).toBe(404);
  });

  it("server actions given a crafted id don't succeed", async () => {
    await sessionFor({ role: "farmer" });
    const result = (await financeActions.issueInvoiceAction("x/notes/y")) as {
      ok: boolean;
    };
    expect(result.ok).toBe(false);
  });
});
