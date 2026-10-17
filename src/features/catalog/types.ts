import type {
  DeliveryMethod,
  ProductCategory,
  ProductUnit,
} from "@shared/constants/catalog";
import type { AtollCode } from "@shared/constants/geography";
import type { LocalizedText } from "@shared/constants/locales";
import type { ProductStatus } from "@shared/schemas";

/**
 * View models returned by the catalog data-access layer (queries.ts) to the
 * public pages. They carry only what the UI needs — never private fields —
 * and island names already resolved from the active data source, so
 * components never look islands up themselves.
 */

export type ImageCredit = {
  author: string;
  license: string;
  licenseUrl: string | null;
  sourceUrl: string;
};

export type CatalogImage = {
  src: string;
  credit?: ImageCredit;
};

/** An island with its atoll, names resolved from the `islands` records. */
export type Place = {
  atollCode: AtollCode;
  islandId: string;
  islandEn: string;
  islandDv?: string;
};

/** A delivery destination: a whole atoll, or one island in it. */
export type DestinationView = {
  atollCode: AtollCode;
  island?: Omit<Place, "atollCode">;
  /** From the farm's matching delivery area, when one exists. */
  method?: DeliveryMethod;
  feeLaari?: number;
};

export type FarmerRef = {
  id: string;
  farmName: LocalizedText;
  verified: boolean;
};

export type ListingCard = {
  id: string;
  title: LocalizedText;
  category: ProductCategory;
  unit: ProductUnit;
  priceLaari: number;
  quantityAvailable: number;
  status: ProductStatus;
  availableFrom?: Date;
  image: CatalogImage | null;
  atollCode: AtollCode;
  islandId: string;
  place: Place;
  farmer: FarmerRef;
  createdAt: Date;
};

export type FarmerContactView = {
  phone: string;
  whatsapp?: string;
  viber?: string;
};

export type FarmerCard = FarmerRef & {
  bio?: LocalizedText;
  atollCode: AtollCode;
  islandId: string;
  place: Place;
  listingCount: number;
  coverImage: CatalogImage | null;
};

export type FarmerDetail = FarmerCard & {
  deliveryDestinations: DestinationView[];
  pickupAvailable: boolean;
  /** Null when contact details must not be shown (e.g. sample data). */
  contact: FarmerContactView | null;
};

export type ListingDetail = ListingCard & {
  description?: LocalizedText;
  minOrderQuantity?: number;
  harvestDate?: Date;
  pickupAvailable: boolean;
  images: CatalogImage[];
  deliveryDestinations: DestinationView[];
  farmer: FarmerDetail;
};

/** Availability as shown to buyers. */
export type Availability =
  | { kind: "available"; quantity: number }
  | { kind: "upcoming"; from: Date }
  | { kind: "sold_out" };
