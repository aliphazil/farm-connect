import "server-only";

import { COLLECTIONS } from "@shared/firestore-paths";
import { TERMS_VERSION } from "@shared/constants/catalog";
import { isRole, type Role } from "@shared/constants/roles";
import { registrationSchema } from "@shared/schemas";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { col, serverNow } from "./db";

export class RegistrationError extends Error {
  constructor(
    public readonly code:
      "already_registered" | "invalid_input" | "account_blocked",
    message?: string,
  ) {
    super(message ?? code);
    this.name = "RegistrationError";
  }
}

/**
 * Completes registration for a Firebase Auth user who has verified their
 * identity (the caller must have verified an ID token for `uid`).
 *
 * - Validates the profile with the shared schema. The role can only be
 *   "consumer" or "farmer"; anything else (including "admin") is rejected.
 * - Creates users/{uid} plus farmerProfiles/{uid} (pending approval) or
 *   consumerProfiles/{uid} in one transaction, only if none exist yet.
 * - Sets the `role` custom claim. Never downgrades or replaces an existing
 *   role claim (so it can't be used to strip or grant admin).
 */
export async function completeRegistration(
  uid: string,
  email: string | undefined,
  input: unknown,
): Promise<Role> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) throw new RegistrationError("invalid_input");
  const profile = parsed.data;

  const auth = getAdminAuth();
  const authUser = await auth.getUser(uid);
  if (authUser.disabled || authUser.customClaims?.blocked) {
    throw new RegistrationError("account_blocked");
  }
  const existingRole = authUser.customClaims?.role;
  if (isRole(existingRole)) throw new RegistrationError("already_registered");

  const db = getAdminDb();
  const userRef = col(COLLECTIONS.users).doc(uid);

  // Repair a previous attempt that saved the profile but failed before the
  // claim was set. Only a self-service role written by this server is restored.
  const existing = await userRef.get();
  if (existing.exists) {
    const savedRole = existing.get("role");
    if (savedRole === "consumer" || savedRole === "farmer") {
      await auth.setCustomUserClaims(uid, {
        ...authUser.customClaims,
        role: savedRole,
      });
      return savedRole;
    }
    throw new RegistrationError("already_registered");
  }

  await db.runTransaction(async (tx) => {
    if ((await tx.get(userRef)).exists)
      throw new RegistrationError("already_registered");
    const now = serverNow();

    tx.create(userRef, {
      role: profile.role,
      status: "active",
      displayName: profile.displayName,
      email,
      phone: profile.phone,
      preferredLocale: profile.preferredLocale,
      location: profile.location,
      termsAcceptedAt: now,
      termsVersion: TERMS_VERSION,
      createdAt: now,
      updatedAt: now,
    });

    if (profile.role === "farmer") {
      tx.create(col(COLLECTIONS.farmerProfiles).doc(uid), {
        farmName: profile.farmName,
        location: profile.location,
        bio: profile.bio,
        address: profile.address,
        contact: { phone: profile.phone, whatsapp: profile.whatsapp },
        pickupAvailable: false,
        deliveryDestinations: [{ atollCode: profile.location.atollCode }],
        approvalStatus: "pending",
        verified: false,
        visible: true,
        createdAt: now,
        updatedAt: now,
      });
    } else {
      tx.create(col(COLLECTIONS.consumerProfiles).doc(uid), {
        defaultDeliveryLocation: profile.location,
        marketingOptIn: false,
        createdAt: now,
        updatedAt: now,
      });
    }
  });

  await auth.setCustomUserClaims(uid, {
    ...authUser.customClaims,
    role: profile.role,
  });
  return profile.role;
}
