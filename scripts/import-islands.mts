/**
 * Imports the official inhabited-island list into the normalised `islands`
 * collection. The app reads islands only from Firestore, so this (with a list
 * from an authoritative source, e.g. the Maldives Bureau of Statistics census
 * or the Local Government Authority) is how islands get into the app.
 *
 *   npm run islands:import -- --file islands.csv            # dry run
 *   npm run islands:import -- --file islands.csv --confirm  # create missing
 *   npm run islands:import -- --file islands.csv --update --confirm
 *
 * CSV columns (header row required): atollCode,nameEn,nameDv[,id]
 *   atollCode — one of the 21 official codes in shared/constants/geography.ts
 *   nameEn    — English name;  nameDv — Dhivehi name (optional)
 *   id        — optional stable id; default "<atoll>-<name-slug>", e.g. "aa-thoddoo"
 * Existing islands are never deleted; they're only changed with --update.
 */
import { readFileSync } from "node:fs";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ATOLL_CODES } from "../shared/constants/geography.ts";
import { COLLECTIONS } from "../shared/firestore-paths.ts";
import { islandIdFor } from "../shared/island-id.ts";
import {
  BOOTSTRAP_ACTOR,
  arg,
  fail,
  flag,
  initAdmin,
  usingEmulators,
} from "./lib/admin-app.mts";

type Row = { id: string; atollCode: string; nameEn: string; nameDv?: string };

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  return rows;
}

export function readIslands(text: string): { rows: Row[]; problems: string[] } {
  const [header, ...lines] = parseCsv(text.replace(/^﻿/, ""));
  const cols = (header ?? []).map((h) => h.trim());
  const at = (name: string) => cols.indexOf(name);
  const problems: string[] = [];
  if (at("atollCode") < 0 || at("nameEn") < 0)
    problems.push('Header must include "atollCode" and "nameEn".');
  const rows: Row[] = [];
  const seen = new Set<string>();
  lines.forEach((line, i) => {
    const get = (name: string) =>
      at(name) >= 0 ? (line[at(name)] ?? "").trim() : "";
    const atollCode = get("atollCode").toUpperCase();
    const nameEn = get("nameEn");
    const where = `line ${i + 2}`;
    if (!(ATOLL_CODES as readonly string[]).includes(atollCode))
      return problems.push(`${where}: unknown atoll "${atollCode}"`);
    if (!nameEn || nameEn.length > 60)
      return problems.push(`${where}: missing or too long nameEn`);
    const id = get("id") || islandIdFor(atollCode, nameEn);
    if (!/^[a-z0-9-]{3,80}$/.test(id))
      return problems.push(`${where}: invalid id "${id}"`);
    if (seen.has(id)) return problems.push(`${where}: duplicate id "${id}"`);
    seen.add(id);
    const nameDv = get("nameDv");
    rows.push({ id, atollCode, nameEn, ...(nameDv ? { nameDv } : {}) });
  });
  return { rows, problems };
}

const file = arg("file");
if (!file)
  fail(
    "Usage: npm run islands:import -- --file islands.csv [--update] --confirm",
  );
const { rows, problems } = readIslands(readFileSync(file, "utf8"));
if (problems.length) fail(`Fix these rows first:\n  ${problems.join("\n  ")}`);

const { app, projectId } = initAdmin();
console.log(`Project: ${projectId}${usingEmulators ? " (emulators)" : ""}`);
console.log(`${rows.length} islands in ${file}`);
if (!flag("confirm"))
  fail("Nothing changed (dry run). Re-run with --confirm to import.");

const db = getFirestore(app);
const update = flag("update");
let created = 0;
let updated = 0;
let unchanged = 0;
for (const row of rows) {
  const { id, ...data } = row;
  const ref = db.collection(COLLECTIONS.islands).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.create({ ...data, active: true });
    created++;
  } else if (update) {
    await ref.set(
      { ...data, active: snap.get("active") ?? true },
      { merge: true },
    );
    updated++;
  } else unchanged++;
}
await db.collection(COLLECTIONS.adminLogs).add({
  actorId: BOOTSTRAP_ACTOR,
  action: "reference.seed",
  targetType: "islands",
  targetId: "import",
  details: { file, created, updated, unchanged },
  createdAt: FieldValue.serverTimestamp(),
});
console.log(
  `✔ Islands: ${created} created, ${updated} updated, ${unchanged} left unchanged.`,
);
