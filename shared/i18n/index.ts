import type { Locale } from "../constants/locales";
import en from "./en.json";
import dvJson from "./dv.json";

export type Dictionary = typeof en;

// Type-level check: Dhivehi must provide every key English has.
const dv: Dictionary = dvJson;

export const dictionaries: Record<Locale, Dictionary> = { en, dv };
