import { favouriteId } from "./firestore-paths";
import { compact } from "./firestore-convert";
import {
  consumerProfileUpdateSchema,
  deliveryAreaInputSchema,
  enquiryInputSchema,
  farmerProfileUpdateSchema,
  fraudReportInputSchema,
  isFarmPublic,
  productDerivedFields,
  productInputSchema,
  userSelfUpdateSchema,
  type ConsumerProfileUpdate,
  type DeliveryAreaInput,
  type EnquiryInput,
  type FarmerProfile,
  type FarmerProfileUpdate,
  type FraudReportInput,
  type FavouriteTarget,
  type Product,
  type ProductInput,
  type UserSelfUpdate,
} from "./schemas";

/**
 * Builders for every document a client (web or mobile) may write directly.
 * Each validates its input with the shared Zod schema, then returns exactly
 * the fields Security Rules expect. `now` is the SDK's serverTimestamp()
 * sentinel (rules require server time), so these stay SDK-agnostic.
 *
 * The rules tests use these same builders, so what the app writes is what
 * the rules are tested against.
 */

type Farm = Pick<FarmerProfile, "location" | "approvalStatus" | "visible">;

/**
 * `requireApproval` mirrors `siteSettings/moderation.listingsRequireApproval`
 * (rules check the new product's moderation against it).
 */
export function buildProductCreate<T>(
  input: ProductInput,
  farm: Farm,
  uid: string,
  now: T,
  requireApproval = false,
) {
  const p = productInputSchema.parse(input);
  const base = {
    ...p,
    farmerId: uid,
    location: farm.location,
    farmerVisible: isFarmPublic(farm),
    moderation: requireApproval ? ("pending" as const) : ("ok" as const),
  };
  return compact({
    ...base,
    ...productDerivedFields(base),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Partial update. Farm-derived fields are refreshed on every save, and the
 * search/visibility fields are recomputed from the merged product, so the
 * caller passes the product's current values. Saving a rejected listing
 * resubmits it for review (moderation → "pending").
 */
export function buildProductUpdate<T>(
  input: Partial<ProductInput>,
  farm: Farm,
  current: Pick<
    Product,
    "status" | "moderation" | "title" | "deliveryDestinations"
  >,
  now: T,
) {
  const p = productInputSchema.partial().parse(input);
  const farmerVisible = isFarmPublic(farm);
  const moderation =
    current.moderation === "rejected" ? "pending" : current.moderation;
  const derived = productDerivedFields({
    status: p.status ?? current.status,
    moderation,
    farmerVisible,
    title: p.title ?? current.title,
    location: farm.location,
    deliveryDestinations:
      p.deliveryDestinations ?? current.deliveryDestinations,
  });
  return compact({
    ...p,
    location: farm.location,
    farmerVisible,
    ...(moderation !== current.moderation ? { moderation } : {}),
    ...derived,
    updatedAt: now,
  });
}

export function buildUserUpdate<T>(input: UserSelfUpdate, now: T) {
  return compact({ ...userSelfUpdateSchema.parse(input), updatedAt: now });
}

export function buildFarmerProfileUpdate<T>(
  input: FarmerProfileUpdate,
  now: T,
) {
  return compact({ ...farmerProfileUpdateSchema.parse(input), updatedAt: now });
}

export function buildConsumerProfileUpdate<T>(
  input: ConsumerProfileUpdate,
  now: T,
) {
  return compact({
    ...consumerProfileUpdateSchema.parse(input),
    updatedAt: now,
  });
}

export function buildDeliveryAreaCreate<T>(
  input: DeliveryAreaInput,
  uid: string,
  now: T,
) {
  return compact({
    ...deliveryAreaInputSchema.parse(input),
    farmerId: uid,
    createdAt: now,
    updatedAt: now,
  });
}

export function buildEnquiryCreate<T>(
  input: EnquiryInput,
  product: { farmerId: string },
  uid: string,
  now: T,
) {
  return compact({
    ...enquiryInputSchema.parse(input),
    farmerId: product.farmerId,
    consumerId: uid,
    status: "new" as const,
    createdAt: now,
    updatedAt: now,
  });
}

export function buildFavourite<T>(
  uid: string,
  targetType: FavouriteTarget,
  targetId: string,
  now: T,
) {
  return {
    id: favouriteId(uid, targetType, targetId),
    data: { userId: uid, targetType, targetId, createdAt: now },
  };
}

export function buildReportCreate<T>(
  input: FraudReportInput,
  uid: string,
  now: T,
) {
  return compact({
    ...fraudReportInputSchema.parse(input),
    reporterId: uid,
    status: "open" as const,
    createdAt: now,
    updatedAt: now,
  });
}
