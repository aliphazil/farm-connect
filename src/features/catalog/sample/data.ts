import {
  productDerivedFields,
  type FarmerProfile,
  type Product,
} from "@shared/schemas";

/**
 * SAMPLE DATA FOR VISUAL DEVELOPMENT ONLY.
 *
 * Fictional farms and listings shaped exactly like the Firestore domain
 * records (validated in data.test.ts), so the UI is built against the real
 * data model. Every page that shows these displays a "sample data" notice.
 * Phone numbers are placeholders and are never shown to visitors.
 *
 * Prices are rough estimates for realistic layouts, not market data.
 */

/** Fixed "today" for sample availability so builds are deterministic. */
export const SAMPLE_NOW = new Date("2026-10-15T07:00:00Z");

const d = (iso: string) => new Date(`${iso}T09:00:00Z`);
const PLACEHOLDER_PHONE = "+9600000000";

type SampleFarmer = FarmerProfile;
type SampleListing = Product;

export const SAMPLE_FARMERS: SampleFarmer[] = [
  {
    uid: "thoddoo-green-fields",
    farmName: { en: "Thoddoo Green Fields", dv: "ތޮއްޑޫ ގްރީން ފީލްޑްސް" },
    bio: {
      en: "Family farm growing watermelon, papaya and chillies on Thoddoo's sandy soil. We ship to Malé twice a week.",
      dv: "ތޮއްޑޫގެ ވެލިގަދަ ބިމުގައި ކަރާ، ފަޅޯ އަދި މިރުސް ހައްދާ ޢާއިލީ ދަނޑެއް. ހަފުތާއަކު ދެ ފަހަރު މާލެއަށް ފޮނުވަމެވެ.",
    },
    location: { atollCode: "AA", islandId: "aa-thoddoo" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [
      { atollCode: "AA" },
      { atollCode: "MLE" },
      { atollCode: "K" },
    ],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: true,
    visible: true,
    createdAt: d("2026-06-02"),
    updatedAt: d("2026-10-10"),
  },
  {
    uid: "hanimaadhoo-growers",
    farmName: { en: "Hanimaadhoo Growers", dv: "ހަނިމާދޫ ގްރޯވަރސް" },
    bio: {
      en: "A group of growers in the north supplying eggplant, pumpkin and cucumber to Haa Dhaalu and Haa Alif.",
      dv: "އުތުރުގެ ދަނޑުވެރިންގެ ގްރޫޕެއް. ހދ. އާއި ހއ. އަށް ބަށި، ބަރަބޯ އަދި ކިރަވަޅު ފޯރުކޮށްދެމެވެ.",
    },
    location: { atollCode: "HDH", islandId: "hdh-hanimaadhoo" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [
      { atollCode: "HDH" },
      { atollCode: "HA" },
      { atollCode: "SH" },
    ],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: true,
    visible: true,
    createdAt: d("2026-07-11"),
    updatedAt: d("2026-10-08"),
  },
  {
    uid: "fuvahmulah-fruit-garden",
    farmName: {
      en: "Fuvahmulah Fruit Garden",
      dv: "ފުވައްމުލައް ފްރޫޓް ގާޑަން",
    },
    bio: {
      en: "Mango, guava, banana and taro from Fuvahmulah's fertile inland gardens.",
      dv: "ފުވައްމުލަކުގެ މޮޅު ބިމުން އަނބު، ފެޔްރު، ދޮންކެޔޮ އަދި އަލަ.",
    },
    location: { atollCode: "GN", islandId: "gn-fuvahmulah" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [
      { atollCode: "GN" },
      { atollCode: "S" },
      { atollCode: "MLE" },
    ],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: false,
    visible: true,
    createdAt: d("2026-08-20"),
    updatedAt: d("2026-10-12"),
  },
  {
    uid: "gan-root-crops",
    farmName: { en: "Gan Root Crops", dv: "ގަން ރޫޓް ކްރޮޕްސް" },
    bio: {
      en: "Cassava, sweet potato and breadfruit grown on Laamu Gan, one of the country's largest farming islands.",
      dv: "ރާއްޖޭގެ އެންމެ ބޮޑު ދަނޑުވެރިކަމުގެ ރަށެއް ކަމަށްވާ ލ. ގަނުގައި ހައްދާ ދަނޑިއަލުވި، ކައްޓެލި އަދި ބަނބުކެޔޮ.",
    },
    location: { atollCode: "L", islandId: "l-gan" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [
      { atollCode: "L" },
      { atollCode: "TH" },
      { atollCode: "MLE" },
    ],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: true,
    visible: true,
    createdAt: d("2026-05-14"),
    updatedAt: d("2026-10-01"),
  },
  {
    uid: "addu-coconut-grove",
    farmName: { en: "Addu Coconut Grove", dv: "އައްޑޫ ކޯކޮނަޓް ގްރޯވް" },
    bio: {
      en: "Coconuts, young drinking coconuts and limes from Hithadhoo.",
      dv: "ހިތަދޫން ކާށި، ކުރުނބާ އަދި ލުނބޯ.",
    },
    location: { atollCode: "S", islandId: "s-hithadhoo" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [{ atollCode: "S" }, { atollCode: "GN" }],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: false,
    visible: true,
    createdAt: d("2026-09-03"),
    updatedAt: d("2026-10-09"),
  },
  {
    uid: "hulhumale-hydro-greens",
    farmName: {
      en: "Hulhumalé Hydro Greens",
      dv: "ހުޅުމާލެ ހައިޑްރޯ ގްރީންސް",
    },
    bio: {
      en: "Hydroponic lettuce, tomatoes and herbs grown in Hulhumalé and delivered across the Greater Malé area.",
      dv: "ހުޅުމާލޭގައި ހައިޑްރޯޕޮނިކްސް ގޮތަށް ހައްދާ ލެޓިއުސް، ޓޮމާޓޯ އަދި ފަތްގަސް. މާލެ ސަރަހައްދަށް ޑެލިވަރ ކުރަމެވެ.",
    },
    location: { atollCode: "MLE", islandId: "mle-hulhumale" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [
      { atollCode: "MLE", islandId: "mle-male" },
      { atollCode: "MLE", islandId: "mle-hulhumale" },
      { atollCode: "MLE", islandId: "mle-villimale" },
    ],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: true,
    visible: true,
    createdAt: d("2026-04-22"),
    updatedAt: d("2026-10-13"),
  },
  {
    uid: "kulhudhuffushi-poultry",
    farmName: { en: "Kulhudhuffushi Poultry", dv: "ކުޅުދުއްފުށި ޕޯލްޓްރީ" },
    bio: {
      en: "Free-range eggs collected daily.",
      dv: "ކޮންމެ ދުވަހަކު ނަގާ ކުކުޅު ބިސް.",
    },
    location: { atollCode: "HDH", islandId: "hdh-kulhudhuffushi" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [{ atollCode: "HDH" }],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: false,
    visible: true,
    createdAt: d("2026-09-28"),
    updatedAt: d("2026-10-14"),
  },
  {
    uid: "thinadhoo-plant-nursery",
    farmName: { en: "Thinadhoo Plant Nursery", dv: "ތިނަދޫ ޕްލާންޓް ނާސަރީ" },
    bio: {
      en: "Vegetable seedlings for home gardens, plus moringa and curry leaves.",
      dv: "ގޭބިސީގެ ދަނޑުތަކަށް ތަރުކާރީ ގަހުގެ ފެޅި، އަދި މުރަނގަ ފަތާއި ހިކަނދިފަތް.",
    },
    location: { atollCode: "GDH", islandId: "gdh-thinadhoo" },
    contact: { phone: PLACEHOLDER_PHONE },
    deliveryDestinations: [{ atollCode: "GDH" }, { atollCode: "GA" }],
    pickupAvailable: false,
    approvalStatus: "approved",
    verified: true,
    visible: true,
    createdAt: d("2026-03-30"),
    updatedAt: d("2026-10-05"),
  },
];

type ListingSeed = {
  id: string;
  farmerId: string;
  image: string;
  title: Product["title"];
  description?: Product["description"];
  category: Product["category"];
  unit: Product["unit"];
  mvr: number;
  quantity: number;
  minOrder?: number;
  status?: Product["status"];
  availableFrom?: string;
  created: string;
};

const SEEDS: ListingSeed[] = [
  {
    id: "thoddoo-watermelon",
    farmerId: "thoddoo-green-fields",
    image: "watermelon",
    title: { en: "Watermelon", dv: "ކަރާ" },
    description: {
      en: "Sweet red-flesh watermelons, 4–7 kg each. Next harvest is coming soon.",
      dv: "4 އިން 7 ކިލޯއާ ހަމައަށް ބަރުދަނުގެ ފޮނި ކަރާ. ދެން ނަގާ ކަރާ އަވަހަށް.",
    },
    category: "fruits",
    unit: "kg",
    mvr: 18,
    quantity: 400,
    minOrder: 5,
    availableFrom: "2026-11-05",
    created: "2026-10-12",
  },
  {
    id: "thoddoo-papaya",
    farmerId: "thoddoo-green-fields",
    image: "papaya",
    title: { en: "Ripe papaya", dv: "ފަޅޯ" },
    description: {
      en: "Picked ripe, ready to eat within 2–3 days.",
      dv: "ފަނި ފަޅޯ، 2-3 ދުވަހުގެ ތެރޭގައި ކެވޭނެ.",
    },
    category: "fruits",
    unit: "kg",
    mvr: 25,
    quantity: 120,
    created: "2026-10-09",
  },
  {
    id: "thoddoo-green-chillies",
    farmerId: "thoddoo-green-fields",
    image: "chillies",
    title: { en: "Green chillies", dv: "ފެހި މިރުސް" },
    description: {
      en: "Hot local chillies, harvested this week.",
      dv: "މި ހަފުތާގައި ނެގި ހުތް ރާއްޖޭގެ މިރުސް.",
    },
    category: "vegetables",
    unit: "kg",
    mvr: 90,
    quantity: 30,
    minOrder: 0.5,
    created: "2026-10-14",
  },
  {
    id: "hanimaadhoo-eggplant",
    farmerId: "hanimaadhoo-growers",
    image: "eggplant",
    title: { en: "Eggplant", dv: "ބަށި" },
    category: "vegetables",
    unit: "kg",
    mvr: 40,
    quantity: 60,
    created: "2026-10-03",
  },
  {
    id: "hanimaadhoo-pumpkin",
    farmerId: "hanimaadhoo-growers",
    image: "pumpkin",
    title: { en: "Pumpkin", dv: "ބަރަބޯ" },
    description: {
      en: "Whole pumpkins, 2–5 kg each.",
      dv: "2 އިން 5 ކިލޯގެ މުޅި ބަރަބޯ.",
    },
    category: "vegetables",
    unit: "kg",
    mvr: 22,
    quantity: 250,
    created: "2026-09-27",
  },
  {
    id: "hanimaadhoo-cucumber",
    farmerId: "hanimaadhoo-growers",
    image: "cucumber",
    title: { en: "Cucumber", dv: "ކިރަވަޅު" },
    category: "vegetables",
    unit: "kg",
    mvr: 30,
    quantity: 80,
    created: "2026-10-11",
  },
  {
    id: "fuvahmulah-mango",
    farmerId: "fuvahmulah-fruit-garden",
    image: "mango",
    title: { en: "Mango", dv: "އަނބު" },
    description: {
      en: "This season's mangoes have sold out.",
      dv: "މި މޫސުމުގެ އަނބު ވިކިގެން ހުސްވެއްޖެ.",
    },
    category: "fruits",
    unit: "kg",
    mvr: 55,
    quantity: 0,
    status: "sold_out",
    created: "2026-09-02",
  },
  {
    id: "fuvahmulah-guava",
    farmerId: "fuvahmulah-fruit-garden",
    image: "guava",
    title: { en: "Pink guava", dv: "ފެޔްރު" },
    category: "fruits",
    unit: "kg",
    mvr: 40,
    quantity: 45,
    created: "2026-10-07",
  },
  {
    id: "fuvahmulah-banana",
    farmerId: "fuvahmulah-fruit-garden",
    image: "banana",
    title: { en: "Banana bunch", dv: "ދޮންކެޔޮ ކަނޑި" },
    description: {
      en: "Green bunches that ripen in about a week.",
      dv: "ގާތްގަނޑަކަށް ހަފުތާއެއްގައި ފަނިވާ ފެހި ކެޔޮ.",
    },
    category: "fruits",
    unit: "bunch",
    mvr: 60,
    quantity: 25,
    created: "2026-10-01",
  },
  {
    id: "fuvahmulah-taro",
    farmerId: "fuvahmulah-fruit-garden",
    image: "taro",
    title: { en: "Taro", dv: "އަލަ" },
    category: "root_crops",
    unit: "kg",
    mvr: 30,
    quantity: 70,
    created: "2026-09-19",
  },
  {
    id: "gan-cassava",
    farmerId: "gan-root-crops",
    image: "cassava",
    title: { en: "Cassava", dv: "ދަނޑިއަލުވި" },
    category: "root_crops",
    unit: "kg",
    mvr: 20,
    quantity: 300,
    minOrder: 2,
    created: "2026-09-25",
  },
  {
    id: "gan-sweet-potato",
    farmerId: "gan-root-crops",
    image: "sweet-potato",
    title: { en: "Sweet potato", dv: "ކައްޓެލި" },
    category: "root_crops",
    unit: "kg",
    mvr: 28,
    quantity: 180,
    created: "2026-10-06",
  },
  {
    id: "gan-breadfruit",
    farmerId: "gan-root-crops",
    image: "breadfruit",
    title: { en: "Breadfruit", dv: "ބަނބުކެޔޮ" },
    category: "fruits",
    unit: "piece",
    mvr: 25,
    quantity: 40,
    created: "2026-10-10",
  },
  {
    id: "addu-coconut",
    farmerId: "addu-coconut-grove",
    image: "coconut",
    title: { en: "Mature coconut", dv: "ކާށި" },
    description: {
      en: "Husked coconuts for grating and cooking.",
      dv: "ހުނި ގާނާ އަދި ކައްކާ ބޭނުމަށް ކާށި.",
    },
    category: "coconut_products",
    unit: "piece",
    mvr: 8,
    quantity: 600,
    minOrder: 10,
    created: "2026-09-30",
  },
  {
    id: "addu-young-coconut",
    farmerId: "addu-coconut-grove",
    image: "young-coconut",
    title: { en: "Young drinking coconut", dv: "ކުރުނބާ" },
    category: "coconut_products",
    unit: "piece",
    mvr: 15,
    quantity: 150,
    created: "2026-10-13",
  },
  {
    id: "addu-lime",
    farmerId: "addu-coconut-grove",
    image: "lime",
    title: { en: "Limes", dv: "ލުނބޯ" },
    category: "fruits",
    unit: "kg",
    mvr: 60,
    quantity: 20,
    created: "2026-10-04",
  },
  {
    id: "hulhumale-lettuce",
    farmerId: "hulhumale-hydro-greens",
    image: "lettuce",
    title: { en: "Butterhead lettuce", dv: "ލެޓިއުސް" },
    description: {
      en: "Hydroponic, pesticide-free, harvested to order.",
      dv: "ހައިޑްރޯޕޮނިކްސް ގޮތަށް ހައްދާ، އޯޑަރ ލިބުމުން ނަގާ.",
    },
    category: "leafy_greens",
    unit: "piece",
    mvr: 25,
    quantity: 90,
    created: "2026-10-14",
  },
  {
    id: "hulhumale-tomatoes",
    farmerId: "hulhumale-hydro-greens",
    image: "tomatoes",
    title: { en: "Tomatoes", dv: "ޓޮމާޓޯ" },
    category: "vegetables",
    unit: "kg",
    mvr: 50,
    quantity: 40,
    created: "2026-10-12",
  },
  {
    id: "hulhumale-basil",
    farmerId: "hulhumale-hydro-greens",
    image: "basil",
    title: { en: "Sweet basil", dv: "ބޭސިލް" },
    category: "herbs_spices",
    unit: "bunch",
    mvr: 10,
    quantity: 60,
    created: "2026-10-08",
  },
  {
    id: "kulhudhuffushi-eggs",
    farmerId: "kulhudhuffushi-poultry",
    image: "eggs",
    title: { en: "Free-range eggs", dv: "ކުކުޅު ބިސް" },
    category: "eggs",
    unit: "dozen",
    mvr: 42,
    quantity: 50,
    created: "2026-10-14",
  },
  {
    id: "thinadhoo-seedlings",
    farmerId: "thinadhoo-plant-nursery",
    image: "seedlings",
    title: { en: "Vegetable seedlings", dv: "ތަރުކާރީ ގަހުގެ ފެޅި" },
    description: {
      en: "Chilli, tomato and eggplant seedlings in pots, ready to plant.",
      dv: "އިންދަން ތައްޔާރަށް ހުރި މިރުސް، ޓޮމާޓޯ އަދި ބަށީގެ ފެޅި.",
    },
    category: "plants_seedlings",
    unit: "piece",
    mvr: 15,
    quantity: 200,
    created: "2026-09-21",
  },
  {
    id: "thinadhoo-moringa",
    farmerId: "thinadhoo-plant-nursery",
    image: "moringa",
    title: { en: "Moringa leaves", dv: "މުރަނގަ ފަތް" },
    category: "leafy_greens",
    unit: "bunch",
    mvr: 10,
    quantity: 35,
    created: "2026-10-02",
  },
  {
    id: "thinadhoo-curry-leaves",
    farmerId: "thinadhoo-plant-nursery",
    image: "curry-leaves",
    title: { en: "Curry leaves", dv: "ހިކަނދިފަތް" },
    category: "herbs_spices",
    unit: "bunch",
    mvr: 5,
    quantity: 80,
    created: "2026-10-05",
  },
];

const farmerById = new Map(SAMPLE_FARMERS.map((f) => [f.uid, f]));

export const SAMPLE_LISTINGS: SampleListing[] = SEEDS.map((seed) => {
  const farmer = farmerById.get(seed.farmerId);
  if (!farmer) throw new Error(`Unknown sample farmer ${seed.farmerId}`);
  const listing = {
    id: seed.id,
    farmerId: seed.farmerId,
    title: seed.title,
    description: seed.description,
    category: seed.category,
    unit: seed.unit,
    priceLaari: Math.round(seed.mvr * 100),
    quantityAvailable: seed.quantity,
    minOrderQuantity: seed.minOrder,
    imagePaths: [`sample/${seed.image}.jpg`],
    location: farmer.location,
    deliveryDestinations: farmer.deliveryDestinations,
    status: seed.status ?? ("active" as const),
    moderation: "ok" as const,
    farmerVisible: true,
    availableFrom: seed.availableFrom ? d(seed.availableFrom) : undefined,
    createdAt: d(seed.created),
    updatedAt: d(seed.created),
  };
  return { ...listing, ...productDerivedFields(listing) };
});

/** Stand-in for the admin-curated `settings/featured` document. */
export const SAMPLE_FEATURED = {
  listingIds: [
    "thoddoo-papaya",
    "hulhumale-tomatoes",
    "kulhudhuffushi-eggs",
    "addu-young-coconut",
    "thoddoo-green-chillies",
    "gan-sweet-potato",
    "fuvahmulah-guava",
    "hulhumale-lettuce",
  ],
  farmerIds: [
    "thoddoo-green-fields",
    "hulhumale-hydro-greens",
    "gan-root-crops",
    "thinadhoo-plant-nursery",
  ],
};

/** Hero photo for the home page. */
export const SAMPLE_HERO_IMAGE = "sample/hero.jpg";
