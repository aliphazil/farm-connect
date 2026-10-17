import "server-only";

import { COLLECTIONS } from "@shared/firestore-paths";
import {
  consumerProfileSchema,
  farmerProfileSchema,
  userSchema,
  type ConsumerProfile,
  type FarmerProfile,
  type UserAccount,
} from "@shared/schemas";
import { getModel } from "./db";

/**
 * Read helpers for the signed-in user's own records. Callers pass the uid
 * from a verified session — never a uid taken from the request.
 */
export function getUserAccount(uid: string): Promise<UserAccount | null> {
  return getModel(COLLECTIONS.users, uid, userSchema, "uid");
}

export function getFarmerProfile(uid: string): Promise<FarmerProfile | null> {
  return getModel(COLLECTIONS.farmerProfiles, uid, farmerProfileSchema, "uid");
}

export function getConsumerProfile(
  uid: string,
): Promise<ConsumerProfile | null> {
  return getModel(
    COLLECTIONS.consumerProfiles,
    uid,
    consumerProfileSchema,
    "uid",
  );
}
