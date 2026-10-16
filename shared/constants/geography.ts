/**
 * Maldivian administrative divisions.
 *
 * `code` is the stable key stored in Firestore — never change an existing code.
 * Names follow common official usage; Dhivehi spellings and the island list
 * should be reviewed by a local before launch. The full inhabited-island list
 * will live in Firestore (`islands` collection) so admins can maintain it; the
 * entries here are a seed of administrative capitals.
 */

export type Atoll = {
  code: string;
  /** Official letter abbreviation, e.g. "HA", "K". */
  abbr: string;
  nameEn: string;
  nameDv: string;
};

export const ATOLLS = [
  { code: "MLE", abbr: "Malé", nameEn: "Malé City", nameDv: "މާލެ ސިޓީ" },
  { code: "HA", abbr: "HA", nameEn: "Haa Alif", nameDv: "ހާ އަލިފު" },
  { code: "HDH", abbr: "HDh", nameEn: "Haa Dhaalu", nameDv: "ހާ ދާލު" },
  { code: "SH", abbr: "Sh", nameEn: "Shaviyani", nameDv: "ށަވިޔަނި" },
  { code: "N", abbr: "N", nameEn: "Noonu", nameDv: "ނޫނު" },
  { code: "R", abbr: "R", nameEn: "Raa", nameDv: "ރާ" },
  { code: "B", abbr: "B", nameEn: "Baa", nameDv: "ބާ" },
  { code: "LH", abbr: "Lh", nameEn: "Lhaviyani", nameDv: "ޅަވިޔަނި" },
  { code: "K", abbr: "K", nameEn: "Kaafu", nameDv: "ކާފު" },
  { code: "AA", abbr: "AA", nameEn: "Alif Alif", nameDv: "އަލިފު އަލިފު" },
  { code: "ADH", abbr: "ADh", nameEn: "Alif Dhaal", nameDv: "އަލިފު ދާލު" },
  { code: "V", abbr: "V", nameEn: "Vaavu", nameDv: "ވާވު" },
  { code: "M", abbr: "M", nameEn: "Meemu", nameDv: "މީމު" },
  { code: "F", abbr: "F", nameEn: "Faafu", nameDv: "ފާފު" },
  { code: "DH", abbr: "Dh", nameEn: "Dhaalu", nameDv: "ދާލު" },
  { code: "TH", abbr: "Th", nameEn: "Thaa", nameDv: "ތާ" },
  { code: "L", abbr: "L", nameEn: "Laamu", nameDv: "ލާމު" },
  { code: "GA", abbr: "GA", nameEn: "Gaafu Alif", nameDv: "ގާފު އަލިފު" },
  { code: "GDH", abbr: "GDh", nameEn: "Gaafu Dhaalu", nameDv: "ގާފު ދާލު" },
  {
    code: "GN",
    abbr: "Gn",
    nameEn: "Gnaviyani (Fuvahmulah)",
    nameDv: "ޏަވިޔަނި (ފުވައްމުލައް)",
  },
  {
    code: "S",
    abbr: "S",
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

/** Seed list: administrative capitals plus Malé's wards. Extend in Firestore. */
export const SEED_ISLANDS: readonly Island[] = [
  { id: "mle-male", atollCode: "MLE", nameEn: "Malé", nameDv: "މާލެ" },
  {
    id: "mle-hulhumale",
    atollCode: "MLE",
    nameEn: "Hulhumalé",
    nameDv: "ހުޅުމާލެ",
  },
  {
    id: "mle-villimale",
    atollCode: "MLE",
    nameEn: "Villimalé",
    nameDv: "ވިލިމާލެ",
  },
  { id: "ha-dhidhdhoo", atollCode: "HA", nameEn: "Dhidhdhoo" },
  { id: "hdh-kulhudhuffushi", atollCode: "HDH", nameEn: "Kulhudhuffushi" },
  { id: "sh-funadhoo", atollCode: "SH", nameEn: "Funadhoo" },
  { id: "n-manadhoo", atollCode: "N", nameEn: "Manadhoo" },
  { id: "r-ungoofaaru", atollCode: "R", nameEn: "Ungoofaaru" },
  { id: "b-eydhafushi", atollCode: "B", nameEn: "Eydhafushi" },
  { id: "lh-naifaru", atollCode: "LH", nameEn: "Naifaru" },
  { id: "k-thulusdhoo", atollCode: "K", nameEn: "Thulusdhoo" },
  { id: "aa-rasdhoo", atollCode: "AA", nameEn: "Rasdhoo" },
  { id: "adh-mahibadhoo", atollCode: "ADH", nameEn: "Mahibadhoo" },
  { id: "v-felidhoo", atollCode: "V", nameEn: "Felidhoo" },
  { id: "m-muli", atollCode: "M", nameEn: "Muli" },
  { id: "f-nilandhoo", atollCode: "F", nameEn: "Nilandhoo" },
  { id: "dh-kudahuvadhoo", atollCode: "DH", nameEn: "Kudahuvadhoo" },
  { id: "th-veymandoo", atollCode: "TH", nameEn: "Veymandoo" },
  { id: "l-fonadhoo", atollCode: "L", nameEn: "Fonadhoo" },
  { id: "ga-villingili", atollCode: "GA", nameEn: "Villingili" },
  { id: "gdh-thinadhoo", atollCode: "GDH", nameEn: "Thinadhoo" },
  { id: "gn-fuvahmulah", atollCode: "GN", nameEn: "Fuvahmulah" },
  { id: "s-hithadhoo", atollCode: "S", nameEn: "Hithadhoo" },
];

export function getAtoll(code: string): Atoll | undefined {
  return ATOLLS.find((a) => a.code === code);
}
