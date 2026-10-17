import type { Island } from "./geography";

/**
 * SAMPLE / DEVELOPMENT DATA — NOT the official island list.
 *
 * A small starter set (administrative capitals, Malé's wards and a few farming
 * islands) used by the sample catalog and, on request, to seed the emulators
 * (`npm run seed:reference -- --sample-islands --confirm`). Production must
 * import the official inhabited-island list with scripts/import-islands.mts.
 */
export const SAMPLE_ISLANDS: readonly Island[] = [
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
  {
    id: "hdh-kulhudhuffushi",
    atollCode: "HDH",
    nameEn: "Kulhudhuffushi",
    nameDv: "ކުޅުދުއްފުށި",
  },
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
  {
    id: "gdh-thinadhoo",
    atollCode: "GDH",
    nameEn: "Thinadhoo",
    nameDv: "ތިނަދޫ",
  },
  {
    id: "gn-fuvahmulah",
    atollCode: "GN",
    nameEn: "Fuvahmulah",
    nameDv: "ފުވައްމުލައް",
  },
  { id: "s-hithadhoo", atollCode: "S", nameEn: "Hithadhoo", nameDv: "ހިތަދޫ" },
  // Islands known for farming.
  { id: "aa-thoddoo", atollCode: "AA", nameEn: "Thoddoo", nameDv: "ތޮއްޑޫ" },
  {
    id: "hdh-hanimaadhoo",
    atollCode: "HDH",
    nameEn: "Hanimaadhoo",
    nameDv: "ހަނިމާދޫ",
  },
  { id: "l-gan", atollCode: "L", nameEn: "Gan", nameDv: "ގަން" },
];
