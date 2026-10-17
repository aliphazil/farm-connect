/**
 * Seeds public reference data: categories, units, atolls, islands and default
 * branding. Only creates documents that don't exist yet — it never
 * overwrites or deletes anything, so it is safe to re-run.
 *
 *   npm run seed:reference -- --confirm
 *   npm run seed:reference -- --sample-islands --confirm   (development only)
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  CATEGORY_ICON,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
} from "../shared/constants/catalog.ts";
import { DEFAULT_BRANDING } from "../shared/constants/branding.ts";
import { ATOLLS } from "../shared/constants/geography.ts";
import { SAMPLE_ISLANDS } from "../shared/constants/sample-islands.ts";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "../shared/firestore-paths.ts";
import en from "../shared/i18n/en.json" with { type: "json" };
import dv from "../shared/i18n/dv.json" with { type: "json" };
import {
  BOOTSTRAP_ACTOR,
  fail,
  flag,
  initAdmin,
  usingEmulators,
} from "./lib/admin-app.mts";

const { app, projectId } = initAdmin();
console.log(`Project: ${projectId}${usingEmulators ? " (emulators)" : ""}`);
if (!flag("confirm"))
  fail(
    "Nothing changed. Re-run with --confirm to create missing reference documents.",
  );

const db = getFirestore(app);
const docs: [string, string, Record<string, unknown>][] = [
  ...PRODUCT_CATEGORIES.map(
    (id, i): [string, string, Record<string, unknown>] => [
      COLLECTIONS.categories,
      id,
      {
        label: { en: en.categories[id], dv: dv.categories[id] },
        icon: CATEGORY_ICON[id],
        sortOrder: i,
        active: true,
      },
    ],
  ),
  ...PRODUCT_UNITS.map((id, i): [string, string, Record<string, unknown>] => [
    COLLECTIONS.units,
    id,
    {
      label: { en: en.units[id], dv: dv.units[id] },
      sortOrder: i,
      active: true,
    },
  ]),
  ...ATOLLS.map((a, i): [string, string, Record<string, unknown>] => [
    COLLECTIONS.atolls,
    a.code,
    {
      abbr: a.abbr,
      abbrDv: a.abbrDv,
      nameEn: a.nameEn,
      nameDv: a.nameDv,
      sortOrder: i,
    },
  ]),
  // Islands come from the official list (scripts/import-islands.mts). The
  // small sample set is only for development/emulators, on explicit request.
  ...(flag("sample-islands") ? SAMPLE_ISLANDS : []).map(
    (s): [string, string, Record<string, unknown>] => [
      COLLECTIONS.islands,
      s.id,
      {
        atollCode: s.atollCode,
        nameEn: s.nameEn,
        ...(s.nameDv ? { nameDv: s.nameDv } : {}),
        active: true,
      },
    ],
  ),
  [
    COLLECTIONS.siteSettings,
    SITE_SETTINGS_DOCS.branding,
    {
      ...DEFAULT_BRANDING,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: BOOTSTRAP_ACTOR,
    },
  ],
];

let created = 0;
let skipped = 0;
for (const [collection, id, data] of docs) {
  try {
    await db.collection(collection).doc(id).create(data);
    created++;
  } catch (error) {
    // 6 = ALREADY_EXISTS: leave existing documents untouched.
    if ((error as { code?: number }).code === 6) skipped++;
    else throw error;
  }
}

await db.collection(COLLECTIONS.adminLogs).add({
  actorId: BOOTSTRAP_ACTOR,
  action: "reference.seed",
  targetType: "reference",
  targetId: "all",
  details: { created, skipped },
  createdAt: FieldValue.serverTimestamp(),
});
console.log(
  `✔ Reference data: ${created} created, ${skipped} already existed (unchanged).`,
);
