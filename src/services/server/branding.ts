import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { adminCan, type AdminLevel } from "@shared/constants/admin";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";
import {
  BRANDING_IMAGE_LIMITS,
  BRANDING_UPLOAD_PREFIX,
  DEFAULT_SITE_CONFIG,
  brandingVersionSchema,
  siteConfigSchema,
  type BrandingVersion,
  type SiteConfig,
  type SiteConfigInput,
} from "@shared/schemas";
import { getAdminDb, getAdminStorage } from "@/lib/firebase/admin";
import { addAdminLog, col, serverNow, snapToModel } from "./db";

/**
 * Branding Studio storage and publishing.
 *
 * - The public site reads only the published config (`siteSettings/branding`),
 *   cached under the "branding" tag, falling back to the built-in defaults.
 * - Drafts (`brandingDrafts/current`) and versions (`brandingVersions`) are
 *   admin-only. Saving a draft never changes the public site.
 * - Every save validates the whole config (shared/schemas/branding.ts) and
 *   checks each image file in Storage. Publishing snapshots a version;
 *   restoring copies a version into the draft. All steps are audit-logged.
 * - Only branding lives here: roles, credentials, payment verification and
 *   other security settings aren't part of this config.
 */

export type BrandingErrorCode =
  | "forbidden"
  | "invalid_input"
  | "invalid_image"
  | "not_found"
  | "no_draft"
  | "conflict";

export class BrandingError extends Error {
  constructor(
    public readonly code: BrandingErrorCode,
    public readonly issues: { path: string; message: string }[] = [],
  ) {
    super(code);
    this.name = "BrandingError";
  }
}

export type BrandingActor = {
  uid: string;
  role: string | null;
  adminLevel?: AdminLevel;
};

function assertCan(actor: BrandingActor) {
  if (actor.role !== "admin" || !adminCan(actor.adminLevel, "branding.manage"))
    throw new BrandingError("forbidden");
}

const publishedRef = () =>
  col(COLLECTIONS.siteSettings).doc(SITE_SETTINGS_DOCS.branding);
const draftRef = () => col(COLLECTIONS.brandingDrafts).doc("current");

/** Older documents stored a flat branding object; map it onto the config. */
function fromLegacy(data: FirebaseFirestore.DocumentData): SiteConfig {
  const c = structuredClone(DEFAULT_SITE_CONFIG);
  if (data.siteName)
    c.identity.siteName = {
      en: data.siteName.en ?? "",
      dv: data.siteName.dv ?? "",
    };
  if (data.tagline)
    c.identity.tagline = {
      en: data.tagline.en ?? "",
      dv: data.tagline.dv ?? "",
    };
  const parsed = siteConfigSchema.safeParse({
    ...c,
    theme: {
      ...c.theme,
      ...(data.primaryColor ? { primary: data.primaryColor } : {}),
      ...(data.accentColor ? { accent: data.accentColor } : {}),
    },
  });
  return parsed.success ? parsed.data : c;
}

function parseStored(
  data: FirebaseFirestore.DocumentData | undefined,
): SiteConfig {
  if (!data) return DEFAULT_SITE_CONFIG;
  if (!data.config) return fromLegacy(data);
  const parsed = siteConfigSchema.safeParse(data.config);
  if (!parsed.success) {
    console.error(
      "Published branding is invalid; using defaults",
      parsed.error.issues,
    );
    return DEFAULT_SITE_CONFIG;
  }
  return parsed.data;
}

const enabled = process.env.CATALOG_SOURCE === "firestore";

/** The published config for the public site (defaults with the sample catalog). */
export async function getPublishedConfig(): Promise<SiteConfig> {
  "use cache";
  cacheTag("branding");
  cacheLife("hours");
  if (!enabled) return DEFAULT_SITE_CONFIG;
  try {
    return parseStored((await publishedRef().get()).data());
  } catch (error) {
    console.error("Branding unavailable; using defaults", error);
    return DEFAULT_SITE_CONFIG;
  }
}

/** Uncached published state for the editor. */
export async function getPublishedState(): Promise<{
  config: SiteConfig;
  version: number | null;
  publishedAt: Date | null;
}> {
  const snap = await publishedRef().get();
  return {
    config: parseStored(snap.data()),
    version: (snap.get("version") as number | undefined) ?? null,
    publishedAt: snap.get("publishedAt")?.toDate?.() ?? null,
  };
}

export async function getDraft(): Promise<{
  config: SiteConfig;
  updatedAt: Date | null;
  basedOnVersion: number | null;
} | null> {
  const snap = await draftRef().get();
  if (!snap.exists) return null;
  const parsed = siteConfigSchema.safeParse(snap.get("config"));
  if (!parsed.success) return null;
  return {
    config: parsed.data,
    updatedAt: snap.get("updatedAt")?.toDate?.() ?? null,
    basedOnVersion: (snap.get("basedOnVersion") as number | undefined) ?? null,
  };
}

function imagePaths(c: SiteConfig): { path: string; favicon: boolean }[] {
  return [
    c.identity.logoPath && { path: c.identity.logoPath, favicon: false },
    c.identity.faviconPath && { path: c.identity.faviconPath, favicon: true },
    c.home.heroImagePath && { path: c.home.heroImagePath, favicon: false },
    c.seo.shareImagePath && { path: c.seo.shareImagePath, favicon: false },
    ...c.home.promos.map(
      (p) => p.imagePath && { path: p.imagePath, favicon: false },
    ),
  ].filter((x): x is { path: string; favicon: boolean } => !!x);
}

/** Each image must be an existing upload of an allowed type and size. */
async function checkImages(c: SiteConfig) {
  const bucket = getAdminStorage().bucket();
  for (const { path, favicon } of imagePaths(c)) {
    if (!path.startsWith(BRANDING_UPLOAD_PREFIX))
      throw new BrandingError("invalid_image");
    const file = bucket.file(path);
    const [exists] = await file.exists();
    if (!exists)
      throw new BrandingError("invalid_image", [{ path, message: "missing" }]);
    const [meta] = await file.getMetadata();
    const type = String(meta.contentType);
    const size = Number(meta.size ?? 0);
    const types: readonly string[] = favicon
      ? [...BRANDING_IMAGE_LIMITS.faviconTypes, ...BRANDING_IMAGE_LIMITS.types]
      : BRANDING_IMAGE_LIMITS.types;
    const max = favicon
      ? BRANDING_IMAGE_LIMITS.faviconBytes
      : BRANDING_IMAGE_LIMITS.bytes;
    if (!types.includes(type) || size <= 0 || size > max)
      throw new BrandingError("invalid_image", [
        { path, message: "type_or_size" },
      ]);
  }
}

export function validateConfig(input: SiteConfigInput): SiteConfig {
  const parsed = siteConfigSchema.safeParse(input);
  if (!parsed.success)
    throw new BrandingError(
      "invalid_input",
      parsed.error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      })),
    );
  return parsed.data;
}

/** Saves the working draft. The public site doesn't change. */
export async function saveDraft(actor: BrandingActor, input: SiteConfigInput) {
  assertCan(actor);
  const config = validateConfig(input);
  await checkImages(config);
  const published = await publishedRef().get();
  const batch = getAdminDb().batch();
  batch.set(draftRef(), {
    config,
    basedOnVersion: (published.get("version") as number | undefined) ?? 0,
    updatedAt: serverNow(),
    updatedBy: actor.uid,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "branding.draft",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.branding,
  });
  await batch.commit();
}

/** Publishes the draft: it becomes the live config and a new version. */
export async function publishDraft(
  actor: BrandingActor,
  note?: string,
): Promise<number> {
  assertCan(actor);
  const cleanNote = note?.trim().slice(0, 200) || undefined;
  const draft = await draftRef().get();
  if (!draft.exists) throw new BrandingError("no_draft");
  const config = validateConfig(draft.get("config"));
  await checkImages(config);

  let number = 0;
  await getAdminDb().runTransaction(async (tx) => {
    const [published, current, latest] = await Promise.all([
      tx.get(publishedRef()),
      tx.get(draftRef()),
      tx.get(
        col(COLLECTIONS.brandingVersions).orderBy("number", "desc").limit(1),
      ),
    ]);
    if (!current.exists) throw new BrandingError("no_draft");
    // Next number after both the live version and the newest stored one, so a
    // reset published document can never collide with existing history.
    number =
      Math.max(
        (published.get("version") as number | undefined) ?? 0,
        (latest.docs[0]?.get("number") as number | undefined) ?? 0,
      ) + 1;
    tx.set(publishedRef(), {
      config,
      version: number,
      publishedAt: serverNow(),
      publishedBy: actor.uid,
    });
    tx.create(
      col(COLLECTIONS.brandingVersions).doc(String(number).padStart(6, "0")),
      {
        number,
        config,
        ...(cleanNote ? { note: cleanNote } : {}),
        publishedBy: actor.uid,
        publishedAt: serverNow(),
      },
    );
    tx.delete(draftRef());
    addAdminLog(tx, {
      actorId: actor.uid,
      action: "branding.publish",
      targetType: "siteSettings",
      targetId: SITE_SETTINGS_DOCS.branding,
      details: { version: number, ...(cleanNote ? { note: cleanNote } : {}) },
    });
  });
  return number;
}

/** Copies a published version into the draft (publish it to make it live). */
export async function restoreVersion(actor: BrandingActor, versionId: string) {
  assertCan(actor);
  if (!/^[0-9]{1,10}$/.test(versionId)) throw new BrandingError("not_found");
  const snap = await col(COLLECTIONS.brandingVersions).doc(versionId).get();
  if (!snap.exists) throw new BrandingError("not_found");
  const config = validateConfig(snap.get("config"));
  const published = await publishedRef().get();
  const batch = getAdminDb().batch();
  batch.set(draftRef(), {
    config,
    basedOnVersion: (published.get("version") as number | undefined) ?? 0,
    restoredFrom: snap.get("number"),
    updatedAt: serverNow(),
    updatedBy: actor.uid,
  });
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "branding.restore",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.branding,
    details: { version: snap.get("number") },
  });
  await batch.commit();
}

/** Throws away the draft. */
export async function discardDraft(actor: BrandingActor) {
  assertCan(actor);
  const batch = getAdminDb().batch();
  batch.delete(draftRef());
  addAdminLog(batch, {
    actorId: actor.uid,
    action: "branding.draft",
    targetType: "siteSettings",
    targetId: SITE_SETTINGS_DOCS.branding,
    details: { discarded: true },
  });
  await batch.commit();
}

export async function listVersions(limit = 20): Promise<BrandingVersion[]> {
  const snap = await col(COLLECTIONS.brandingVersions)
    .orderBy("number", "desc")
    .limit(limit)
    .get();
  return snap.docs
    .map((d) => {
      try {
        return snapToModel(brandingVersionSchema, d);
      } catch {
        return null;
      }
    })
    .filter((v): v is BrandingVersion => v !== null);
}
