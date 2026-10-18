import {
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { COLLECTIONS } from "@shared/firestore-paths";
import { buildEnquiryCreate, buildFavourite } from "@shared/payloads";
import {
  enquirySchema,
  favouriteSchema,
  productSchema,
  type EnquiryInput,
  type EnquiryStatus,
  type FavouriteTarget,
} from "@shared/schemas";
import { colRef, docRef, now, requireUid, snapToModel } from "./firestore";

/** Consumer-side interactions: favourites, enquiries, reports. */

// ---------- favourites (products and farms) ----------
export async function addFavourite(
  targetType: FavouriteTarget,
  targetId: string,
) {
  const { id, data } = buildFavourite(
    await requireUid(),
    targetType,
    targetId,
    now(),
  );
  await setDoc(docRef(COLLECTIONS.favourites, id), data);
}

export async function removeFavourite(
  targetType: FavouriteTarget,
  targetId: string,
) {
  await deleteDoc(
    docRef(
      COLLECTIONS.favourites,
      buildFavourite(await requireUid(), targetType, targetId, null).id,
    ),
  );
}

export async function isFavourite(
  targetType: FavouriteTarget,
  targetId: string,
): Promise<boolean> {
  const id = buildFavourite(await requireUid(), targetType, targetId, null).id;
  return (await getDoc(docRef(COLLECTIONS.favourites, id))).exists();
}

export async function listMyFavourites() {
  const snap = await getDocs(
    query(
      colRef(COLLECTIONS.favourites),
      where("userId", "==", await requireUid()),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => snapToModel(favouriteSchema, d)!);
}

// ---------- enquiries ----------
export async function sendEnquiry(input: EnquiryInput): Promise<string> {
  const product = snapToModel(
    productSchema,
    await getDoc(docRef(COLLECTIONS.products, input.productId)),
  );
  if (!product) throw new Error("Product not found");
  const ref = await addDoc(
    colRef(COLLECTIONS.enquiries),
    buildEnquiryCreate(input, product, await requireUid(), now()),
  );
  return ref.id;
}

/** Farmer: accept/decline/complete. Consumer: cancel. Rules enforce who may do what. */
export async function setEnquiryStatus(
  enquiryId: string,
  status: EnquiryStatus,
) {
  await updateDoc(docRef(COLLECTIONS.enquiries, enquiryId), {
    status,
    updatedAt: now(),
  });
}

export async function listMyEnquiries(as: "farmer" | "consumer") {
  const field = as === "farmer" ? "farmerId" : "consumerId";
  const snap = await getDocs(
    query(
      colRef(COLLECTIONS.enquiries),
      where(field, "==", await requireUid()),
      orderBy("createdAt", "desc"),
    ),
  );
  return snap.docs.map((d) => snapToModel(enquirySchema, d)!);
}

// ---------- reports ----------
// Reports are submitted through the server (src/features/reports/actions.ts),
// which validates the target, prevents duplicates and rate-limits.
