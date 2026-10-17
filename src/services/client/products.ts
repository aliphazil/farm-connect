import {
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { COLLECTIONS, SITE_SETTINGS_DOCS } from "@shared/firestore-paths";
import {
  buildDeliveryAreaCreate,
  buildFarmerProfileUpdate,
  buildProductCreate,
  buildProductUpdate,
} from "@shared/payloads";
import {
  deliveryAreaInputSchema,
  deliveryAreaSchema,
  productSchema,
  type DeliveryAreaInput,
  type DeliveryDestination,
  type ProductInput,
  type ProductStatus,
} from "@shared/schemas";
import { getMyFarmerProfile } from "./account";
import { colRef, docRef, now, requireUid, snapToModel } from "./firestore";
import { deleteStoredFile } from "./uploads";

/**
 * Farmer-side product and delivery-area management. Security Rules ensure a
 * farmer can only touch their own documents, that farm-derived fields
 * (location, visibility) are genuine, and that moderated products are locked.
 */

async function myFarm() {
  const farm = await getMyFarmerProfile();
  if (!farm) throw new Error("No farm profile");
  return farm;
}

/** A new product id, so photos can be uploaded under it before saving. */
export function newProductId(): string {
  return doc(colRef(COLLECTIONS.products)).id;
}

/** Whether new listings currently need admin approval (public setting). */
export async function listingsRequireApproval(): Promise<boolean> {
  const snap = await getDoc(
    docRef(COLLECTIONS.siteSettings, SITE_SETTINGS_DOCS.moderation),
  );
  return snap.exists() && snap.get("listingsRequireApproval") === true;
}

export async function createProduct(
  productId: string,
  input: ProductInput,
): Promise<string> {
  const [farm, uid, requireApproval] = await Promise.all([
    myFarm(),
    requireUid(),
    listingsRequireApproval(),
  ]);
  await setDoc(
    docRef(COLLECTIONS.products, productId),
    buildProductCreate(input, farm, uid, now(), requireApproval),
  );
  return productId;
}

export async function updateProduct(
  productId: string,
  input: Partial<ProductInput>,
) {
  // Derived fields (visibility, search tokens) are recomputed from the merged product.
  const current = snapToModel(
    productSchema,
    await getDoc(docRef(COLLECTIONS.products, productId)),
  );
  if (!current) throw new Error("Product not found");
  await updateDoc(
    docRef(COLLECTIONS.products, productId),
    buildProductUpdate(input, await myFarm(), current, now()),
  );
}

export function setProductStatus(productId: string, status: ProductStatus) {
  return updateProduct(productId, { status });
}

export function setProductQuantity(
  productId: string,
  quantityAvailable: number,
) {
  return updateProduct(productId, { quantityAvailable });
}

/** Deletes the product, then its photos (best effort). */
export async function deleteProduct(productId: string) {
  const snap = await getDoc(docRef(COLLECTIONS.products, productId));
  const paths: string[] = snap.exists() ? (snap.get("imagePaths") ?? []) : [];
  await deleteDoc(docRef(COLLECTIONS.products, productId));
  await Promise.allSettled(paths.map(deleteStoredFile));
}

export async function listMyProducts() {
  const snap = await getDocs(
    query(
      colRef(COLLECTIONS.products),
      where("farmerId", "==", await requireUid()),
    ),
  );
  return snap.docs
    .map((d) => snapToModel(productSchema, d)!)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * After the farm's location or approval changes, refresh the copies held on
 * each product (rules require them to match). Removed and rejected products
 * are skipped: removed ones are locked, and saving a rejected one would
 * resubmit it for review.
 */
export async function syncProductsWithFarm(): Promise<number> {
  const farm = await myFarm();
  const products = await listMyProducts();
  const editable = products.filter(
    (p) => p.moderation === "ok" || p.moderation === "pending",
  );
  await Promise.all(
    editable.map((p) =>
      updateDoc(
        docRef(COLLECTIONS.products, p.id),
        buildProductUpdate({}, farm, p, now()),
      ),
    ),
  );
  return editable.length;
}

// ---------- delivery areas ----------

export async function listMyDeliveryAreas() {
  const snap = await getDocs(
    query(
      colRef(COLLECTIONS.deliveryAreas),
      where("farmerId", "==", await requireUid()),
    ),
  );
  return snap.docs.map((d) => snapToModel(deliveryAreaSchema, d)!);
}

/** Keeps farmerProfiles.deliveryDestinations in step with active areas. */
async function syncDeliverySummary() {
  const areas = await listMyDeliveryAreas();
  const destinations: DeliveryDestination[] = areas
    .filter((a) => a.active)
    .map((a) =>
      a.islandId
        ? { atollCode: a.atollCode, islandId: a.islandId }
        : { atollCode: a.atollCode },
    );
  await updateDoc(
    docRef(COLLECTIONS.farmerProfiles, await requireUid()),
    buildFarmerProfileUpdate({ deliveryDestinations: destinations }, now()),
  );
}

export async function createDeliveryArea(
  input: DeliveryAreaInput,
): Promise<string> {
  const ref = await addDoc(
    colRef(COLLECTIONS.deliveryAreas),
    buildDeliveryAreaCreate(input, await requireUid(), now()),
  );
  await syncDeliverySummary();
  return ref.id;
}

export async function updateDeliveryArea(
  areaId: string,
  input: Partial<DeliveryAreaInput>,
) {
  await updateDoc(docRef(COLLECTIONS.deliveryAreas, areaId), {
    ...deliveryAreaInputSchema.partial().parse(input),
    updatedAt: now(),
  });
  await syncDeliverySummary();
}

export async function deleteDeliveryArea(areaId: string) {
  await deleteDoc(docRef(COLLECTIONS.deliveryAreas, areaId));
  await syncDeliverySummary();
}
