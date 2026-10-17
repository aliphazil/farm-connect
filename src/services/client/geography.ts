import { getDocs } from "firebase/firestore";
import type { AtollCode, Island } from "@shared/constants/geography";
import { COLLECTIONS } from "@shared/firestore-paths";
import { colRef } from "./firestore";

/**
 * Normalised atoll and island records from Firestore (`atolls`, `islands`),
 * which are publicly readable. Loaded once per page session.
 */
export type AtollRecord = {
  code: AtollCode;
  abbr: string;
  abbrDv: string;
  nameEn: string;
  nameDv: string;
  sortOrder: number;
};

export type Geography = { atolls: AtollRecord[]; islands: Island[] };

let pending: Promise<Geography> | null = null;

export function loadGeography(): Promise<Geography> {
  pending ??= (async () => {
    const [atollSnap, islandSnap] = await Promise.all([
      getDocs(colRef(COLLECTIONS.atolls)),
      getDocs(colRef(COLLECTIONS.islands)),
    ]);
    const atolls = atollSnap.docs
      .map((d) => ({
        code: d.id as AtollCode,
        ...(d.data() as Omit<AtollRecord, "code">),
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const islands = islandSnap.docs
      .filter((d) => d.get("active") !== false)
      .map((d) => ({
        id: d.id,
        atollCode: d.get("atollCode") as AtollCode,
        nameEn: d.get("nameEn") as string,
        nameDv: (d.get("nameDv") as string | undefined) ?? undefined,
      }))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
    return { atolls, islands };
  })().catch((error) => {
    pending = null; // allow a retry
    throw error;
  });
  return pending;
}
