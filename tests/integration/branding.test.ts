import { randomUUID } from "node:crypto";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@shared/firestore-paths";
import { DEFAULT_SITE_CONFIG, type SiteConfig } from "@shared/schemas";
import {
  getAdminAuth,
  getAdminDb,
  getAdminStorage,
} from "@/lib/firebase/admin";
import { getClientAuth } from "@/lib/firebase/client";
import {
  BrandingError,
  discardDraft,
  getDraft,
  getPublishedConfig,
  getPublishedState,
  listVersions,
  publishDraft,
  restoreVersion,
  saveDraft,
  type BrandingActor,
} from "@/services/server/branding";
import { completeRegistration } from "@/services/server/registration";
import {
  publishBrandingAction,
  saveBrandingDraftAction,
} from "@/features/admin/actions";
import { proxy } from "@/proxy";
import { setTestCookie } from "../support/next-headers-stub";

/**
 * Branding Studio against the emulators: drafts stay private until
 * published, validation, image checks, versions and restore, audit logs,
 * permissions (services and Server Actions) and language routing.
 */

const PASSWORD = "correct-horse-battery";
const owner: BrandingActor = {
  uid: "brand-owner",
  role: "admin",
  adminLevel: "owner",
};
const moderator: BrandingActor = {
  uid: "brand-mod",
  role: "admin",
  adminLevel: "moderator",
};
const farmer: BrandingActor = { uid: "brand-farmer", role: "farmer" };

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof BrandingError ? e.code : `other:${String(e)}`;
  }
};
const config = (fn: (c: SiteConfig) => void = () => undefined) => {
  const c = structuredClone(DEFAULT_SITE_CONFIG);
  fn(c);
  return c;
};
const bucket = () => getAdminStorage().bucket();
const PNG = Buffer.from(
  "89504e470d0a1a0a0000000d4948445200000001000000010806000000" +
    "1f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082",
  "hex",
);

async function account(claims: Record<string, unknown> | null) {
  const email = `brand-${randomUUID()}@example.test`;
  const { uid } = await getAdminAuth().createUser({
    email,
    password: PASSWORD,
  });
  if (claims) {
    await getAdminAuth().setCustomUserClaims(uid, claims);
    await getAdminDb().collection(COLLECTIONS.users).doc(uid).set({
      role: "admin",
      status: "active",
      displayName: "Admin",
      preferredLocale: "en",
    });
  } else {
    await completeRegistration(uid, email, {
      role: "consumer",
      displayName: "Buyer",
      preferredLocale: "en",
      acceptTerms: true,
    });
  }
  return email;
}
async function session(email: string | null) {
  if (!email) return setTestCookie("__session", null);
  await signOut(getClientAuth()).catch(() => undefined);
  const { user } = await signInWithEmailAndPassword(
    getClientAuth(),
    email,
    PASSWORD,
  );
  const idToken = await user.getIdToken(true);
  setTestCookie(
    "__session",
    await getAdminAuth().createSessionCookie(idToken, { expiresIn: 3600_000 }),
  );
}

beforeAll(async () => {
  if (!process.env.FIREBASE_STORAGE_EMULATOR_HOST)
    throw new Error("Run through `npm run test:emulator`");
  await getAdminDb()
    .collection(COLLECTIONS.brandingDrafts)
    .doc("current")
    .delete();
});

afterAll(async () => {
  // Leave the built-in look published for anything that runs later.
  await saveDraft(owner, DEFAULT_SITE_CONFIG);
  await publishDraft(owner, "Test reset");
  setTestCookie("__session", null);
  await signOut(getClientAuth()).catch(() => undefined);
});

describe("drafts", () => {
  it("saving a draft doesn't change what the public site reads", async () => {
    const before = await getPublishedConfig();
    await saveDraft(
      owner,
      config((c) => void (c.identity.siteName = { en: "Draft Name", dv: "" })),
    );
    expect((await getDraft())?.config.identity.siteName.en).toBe("Draft Name");
    expect((await getPublishedConfig()).identity.siteName.en).toBe(
      before.identity.siteName.en,
    );
  });

  it("rejects invalid settings with field-level reasons", async () => {
    let err: unknown;
    try {
      await saveDraft(
        owner,
        config((c) => {
          c.theme.text = "#f0f0f0";
          c.footer.about.en = "Read [this](javascript:alert(1))";
          c.home.primaryCta.href = "https://evil.example";
        }),
      );
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(BrandingError);
    const messages = (err as BrandingError).issues.map((i) => i.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        "low_contrast_text",
        "unsafe_link",
        "invalid_internal_link",
      ]),
    );
  });
});

describe("images", () => {
  it("accepts a real uploaded image and rejects missing, disguised or foreign files", async () => {
    const ok = `branding/uploads/logo-${randomUUID().slice(0, 8)}.png`;
    await bucket().file(ok).save(PNG, { contentType: "image/png" });
    expect(
      await code(
        saveDraft(
          owner,
          config((c) => void (c.identity.logoPath = ok)),
        ),
      ),
    ).toBe("ok");

    expect(
      await code(
        saveDraft(
          owner,
          config(
            (c) => void (c.identity.logoPath = "branding/uploads/missing.png"),
          ),
        ),
      ),
    ).toBe("invalid_image");

    const disguised = `branding/uploads/evil-${randomUUID().slice(0, 8)}.png`;
    await bucket()
      .file(disguised)
      .save("<svg onload=alert(1)>", { contentType: "image/svg+xml" });
    expect(
      await code(
        saveDraft(
          owner,
          config((c) => void (c.identity.logoPath = disguised)),
        ),
      ),
    ).toBe("invalid_image");

    const big = `branding/uploads/big-${randomUUID().slice(0, 8)}.png`;
    await bucket()
      .file(big)
      .save(Buffer.alloc(2 * 1024 * 1024 + 1), { contentType: "image/png" });
    expect(
      await code(
        saveDraft(
          owner,
          config((c) => void (c.home.heroImagePath = big)),
        ),
      ),
    ).toBe("invalid_image");

    // Outside the branding folder: rejected by the schema.
    expect(
      await code(
        saveDraft(
          owner,
          config((c) => void (c.identity.logoPath = "products/x/y.png")),
        ),
      ),
    ).toBe("invalid_input");
  });
});

describe("publishing and history", () => {
  it("publish makes the draft live, records a version and an audit entry", async () => {
    await saveDraft(
      owner,
      config((c) => {
        c.identity.siteName = { en: "Version One", dv: "" };
        c.theme.primary = "#1d4ed8";
      }),
    );
    const v1 = await publishDraft(owner, "Blue look");
    const state = await getPublishedState();
    expect(state).toMatchObject({ version: v1 });
    expect(state.config.identity.siteName.en).toBe("Version One");
    expect((await getPublishedConfig()).theme.primary).toBe("#1d4ed8");
    expect(await getDraft()).toBeNull();
    expect(await code(publishDraft(owner))).toBe("no_draft");

    const logs = await getAdminDb()
      .collection(COLLECTIONS.adminLogs)
      .where("action", "==", "branding.publish")
      .get();
    expect(
      logs.docs.some(
        (d) =>
          d.get("details.version") === v1 && d.get("actorId") === owner.uid,
      ),
    ).toBe(true);
  });

  it("restore copies an old version into the draft; publishing it makes it live again", async () => {
    await saveDraft(
      owner,
      config((c) => void (c.identity.siteName = { en: "Version Two", dv: "" })),
    );
    const v2 = await publishDraft(owner);
    const versions = await listVersions();
    const one = versions.find(
      (v) => v.config.identity.siteName.en === "Version One",
    )!;
    expect(versions[0].number).toBe(v2);

    await restoreVersion(owner, one.id);
    expect((await getDraft())?.config.identity.siteName.en).toBe("Version One");
    // Not live until published.
    expect((await getPublishedConfig()).identity.siteName.en).toBe(
      "Version Two",
    );
    const v3 = await publishDraft(owner, "Back to blue");
    expect(v3).toBe(v2 + 1);
    expect((await getPublishedConfig()).identity.siteName.en).toBe(
      "Version One",
    );
    expect(await code(restoreVersion(owner, "../../users"))).toBe("not_found");
  });

  it("drafts can be discarded without touching the live site", async () => {
    await saveDraft(
      owner,
      config((c) => void (c.identity.siteName = { en: "Throwaway", dv: "" })),
    );
    await discardDraft(owner);
    expect(await getDraft()).toBeNull();
    expect((await getPublishedConfig()).identity.siteName.en).toBe(
      "Version One",
    );
  });
});

describe("who can change branding", () => {
  it("only owner-level admins, at the service level", async () => {
    expect(await code(saveDraft(moderator, DEFAULT_SITE_CONFIG))).toBe(
      "forbidden",
    );
    expect(await code(publishDraft(moderator))).toBe("forbidden");
    expect(await code(saveDraft(farmer, DEFAULT_SITE_CONFIG))).toBe(
      "forbidden",
    );
    expect(await code(restoreVersion({ uid: "x", role: null }, "000001"))).toBe(
      "forbidden",
    );
  });

  it("and through the Server Actions with real sessions", async () => {
    await session(await account(null));
    expect(await saveBrandingDraftAction(DEFAULT_SITE_CONFIG)).toEqual({
      ok: false,
      error: "unauthorized",
    });
    await session(await account({ role: "admin", adminLevel: "moderator" }));
    expect(await publishBrandingAction()).toEqual({
      ok: false,
      error: "unauthorized",
    });
    await session(await account({ role: "admin", adminLevel: "owner" }));
    const bad = await saveBrandingDraftAction(
      config((c) => void (c.theme.primary = "#ffff00")),
    );
    expect(bad).toMatchObject({ ok: false, error: "invalid_input" });
    expect(
      await saveBrandingDraftAction(
        config(
          (c) => void (c.identity.siteName = { en: "Via action", dv: "" }),
        ),
      ),
    ).toEqual({ ok: true });
    await session(null);
  });
});

describe("languages", () => {
  it("the proxy follows the published default and enabled languages", async () => {
    await saveDraft(
      owner,
      config((c) => void (c.languages = { default: "dv", enabled: ["dv"] })),
    );
    await publishDraft(owner);
    const go = async (path: string, headers: Record<string, string> = {}) =>
      (
        await proxy(new NextRequest(`http://localhost${path}`, { headers }))
      )?.headers.get("location");
    expect(await go("/en/products")).toBe("http://localhost/dv/products");
    expect(await go("/", { "accept-language": "en-US" })).toBe(
      "http://localhost/dv",
    );
    expect(await go("/dv/products")).toBeFalsy(); // enabled: no redirect
  });
});
