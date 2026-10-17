/**
 * Maldivian administrative divisions.
 *
 * `code` is the stable key stored in Firestore — never change an existing code.
 * The 20 administrative atolls plus Malé City are a fixed, official set.
 * Islands are NOT hardcoded here: the app reads them from the normalised
 * `islands` collection, imported from an official list
 * (scripts/import-islands.mts). See sample-islands.ts for development data.
 */

export type Atoll = {
  code: string;
  /** Official letter abbreviation, e.g. "HA", "K". */
  abbr: string;
  /** Thaana letter abbreviation, e.g. "ހއ", "ކ". */
  abbrDv: string;
  nameEn: string;
  nameDv: string;
};

export const ATOLLS = [
  {
    code: "MLE",
    abbr: "Malé",
    abbrDv: "މާލެ",
    nameEn: "Malé City",
    nameDv: "މާލެ ސިޓީ",
  },
  {
    code: "HA",
    abbr: "HA",
    abbrDv: "ހއ",
    nameEn: "Haa Alif",
    nameDv: "ހާ އަލިފު",
  },
  {
    code: "HDH",
    abbr: "HDh",
    abbrDv: "ހދ",
    nameEn: "Haa Dhaalu",
    nameDv: "ހާ ދާލު",
  },
  {
    code: "SH",
    abbr: "Sh",
    abbrDv: "ށ",
    nameEn: "Shaviyani",
    nameDv: "ށަވިޔަނި",
  },
  { code: "N", abbr: "N", abbrDv: "ނ", nameEn: "Noonu", nameDv: "ނޫނު" },
  { code: "R", abbr: "R", abbrDv: "ރ", nameEn: "Raa", nameDv: "ރާ" },
  { code: "B", abbr: "B", abbrDv: "ބ", nameEn: "Baa", nameDv: "ބާ" },
  {
    code: "LH",
    abbr: "Lh",
    abbrDv: "ޅ",
    nameEn: "Lhaviyani",
    nameDv: "ޅަވިޔަނި",
  },
  { code: "K", abbr: "K", abbrDv: "ކ", nameEn: "Kaafu", nameDv: "ކާފު" },
  {
    code: "AA",
    abbr: "AA",
    abbrDv: "އއ",
    nameEn: "Alif Alif",
    nameDv: "އަލިފު އަލިފު",
  },
  {
    code: "ADH",
    abbr: "ADh",
    abbrDv: "އދ",
    nameEn: "Alif Dhaal",
    nameDv: "އަލިފު ދާލު",
  },
  { code: "V", abbr: "V", abbrDv: "ވ", nameEn: "Vaavu", nameDv: "ވާވު" },
  { code: "M", abbr: "M", abbrDv: "މ", nameEn: "Meemu", nameDv: "މީމު" },
  { code: "F", abbr: "F", abbrDv: "ފ", nameEn: "Faafu", nameDv: "ފާފު" },
  { code: "DH", abbr: "Dh", abbrDv: "ދ", nameEn: "Dhaalu", nameDv: "ދާލު" },
  { code: "TH", abbr: "Th", abbrDv: "ތ", nameEn: "Thaa", nameDv: "ތާ" },
  { code: "L", abbr: "L", abbrDv: "ލ", nameEn: "Laamu", nameDv: "ލާމު" },
  {
    code: "GA",
    abbr: "GA",
    abbrDv: "ގއ",
    nameEn: "Gaafu Alif",
    nameDv: "ގާފު އަލިފު",
  },
  {
    code: "GDH",
    abbr: "GDh",
    abbrDv: "ގދ",
    nameEn: "Gaafu Dhaalu",
    nameDv: "ގާފު ދާލު",
  },
  {
    code: "GN",
    abbr: "Gn",
    abbrDv: "ޏ",
    nameEn: "Gnaviyani (Fuvahmulah)",
    nameDv: "ޏަވިޔަނި (ފުވައްމުލައް)",
  },
  {
    code: "S",
    abbr: "S",
    abbrDv: "ސ",
    nameEn: "Seenu (Addu City)",
    nameDv: "ސީނު (އައްޑޫ ސިޓީ)",
  },
] as const satisfies readonly Atoll[];

export type AtollCode = (typeof ATOLLS)[number]["code"];

export const ATOLL_CODES = ATOLLS.map((a) => a.code) as [
  AtollCode,
  ...AtollCode[],
];

export type Island = {
  /** Stable slug, unique across the country, e.g. "k-thulusdhoo". */
  id: string;
  atollCode: AtollCode;
  nameEn: string;
  /** Optional until verified. */
  nameDv?: string;
};

export function getAtoll(code: string): Atoll | undefined {
  return ATOLLS.find((a) => a.code === code);
}

export function atollName(atoll: Atoll, locale: "en" | "dv"): string {
  return locale === "dv" ? atoll.nameDv : atoll.nameEn;
}

/** Dhivehi island names fall back to English until a Dhivehi name is recorded. */
export function islandName(
  island: { nameEn: string; nameDv?: string },
  locale: "en" | "dv",
): string {
  return locale === "dv" ? (island.nameDv ?? island.nameEn) : island.nameEn;
}

/**
 * "AA. Thoddoo" / "އއ. ތޮއްޑޫ" style label for an island whose names were
 * resolved from the `islands` records. Malé City islands show without prefix.
 */
export function placeText(
  place: { atollCode: string; islandEn: string; islandDv?: string },
  locale: "en" | "dv",
): string {
  const name =
    locale === "dv" ? (place.islandDv ?? place.islandEn) : place.islandEn;
  const atoll = getAtoll(place.atollCode);
  if (!atoll || atoll.code === "MLE") return name;
  return `${locale === "dv" ? atoll.abbrDv : atoll.abbr}. ${name}`;
}
