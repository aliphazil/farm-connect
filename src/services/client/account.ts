import { deleteField, getDoc, updateDoc, writeBatch } from "firebase/firestore";
import { COLLECTIONS } from "@shared/firestore-paths";
import {
  buildConsumerProfileUpdate,
  buildFarmerProfileUpdate,
  buildUserUpdate,
} from "@shared/payloads";
import {
  consumerProfileSchema,
  farmerProfileSchema,
  userSchema,
  type ConsumerProfileUpdate,
  type FarmerProfileUpdate,
  type UserSelfUpdate,
} from "@shared/schemas";
import { getClientDb } from "@/lib/firebase/client";
import { docRef, now, requireUid, snapToModel } from "./firestore";

/** The signed-in user's own records. Rules limit which fields can change. */

export async function getMyAccount() {
  return snapToModel(
    userSchema,
    await getDoc(docRef(COLLECTIONS.users, await requireUid())),
    "uid",
  );
}

export async function updateMyAccount(input: UserSelfUpdate) {
  await updateDoc(
    docRef(COLLECTIONS.users, await requireUid()),
    buildUserUpdate(input, now()),
  );
}

export async function getMyFarmerProfile() {
  return snapToModel(
    farmerProfileSchema,
    await getDoc(docRef(COLLECTIONS.farmerProfiles, await requireUid())),
    "uid",
  );
}

export async function updateMyFarmerProfile(input: FarmerProfileUpdate) {
  await updateDoc(
    docRef(COLLECTIONS.farmerProfiles, await requireUid()),
    buildFarmerProfileUpdate(input, now()),
  );
}

export async function getMyConsumerProfile() {
  return snapToModel(
    consumerProfileSchema,
    await getDoc(docRef(COLLECTIONS.consumerProfiles, await requireUid())),
    "uid",
  );
}

export async function updateMyConsumerProfile(input: ConsumerProfileUpdate) {
  await updateDoc(
    docRef(COLLECTIONS.consumerProfiles, await requireUid()),
    buildConsumerProfileUpdate(input, now()),
  );
}

/** Optional farm-profile fields a farmer can clear. */
export type ClearableFarmField = "bio" | "logoPath" | "address" | "mapLocation";

/**
 * Saves farm-profile changes and deletes the fields the farmer cleared
 * (a plain update would just skip empty values).
 */
export async function saveMyFarmerProfile(
  input: FarmerProfileUpdate,
  clear: ClearableFarmField[] = [],
) {
  const data: Record<string, unknown> = {
    ...buildFarmerProfileUpdate(input, now()),
  };
  for (const field of clear) data[field] = deleteField();
  await updateDoc(docRef(COLLECTIONS.farmerProfiles, await requireUid()), data);
}

/**
 * Buyer settings: account fields plus (for consumers) delivery preferences,
 * saved together. `clearPhone` removes the stored number.
 */
export async function saveMySettings(
  account: UserSelfUpdate,
  options: { clearPhone?: boolean; consumer?: ConsumerProfileUpdate } = {},
) {
  const uid = await requireUid();
  const batch = writeBatch(getClientDb());
  const user: Record<string, unknown> = { ...buildUserUpdate(account, now()) };
  if (options.clearPhone) user.phone = deleteField();
  batch.update(docRef(COLLECTIONS.users, uid), user);
  if (options.consumer)
    batch.update(
      docRef(COLLECTIONS.consumerProfiles, uid),
      buildConsumerProfileUpdate(options.consumer, now()),
    );
  await batch.commit();
}
