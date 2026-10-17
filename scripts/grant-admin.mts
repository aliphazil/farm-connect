/**
 * Grants (or revokes) the admin role. This is the ONLY way to create an
 * administrator: public registration can't, and the app has no endpoint for it.
 * Running it requires Admin SDK credentials (service account or ADC), which
 * only project owners have.
 *
 *   npm run admin:grant -- --email you@example.com --level owner --confirm
 *   npm run admin:grant -- --email mod@example.com --level moderator --confirm
 *   npm run admin:grant -- --email you@example.com --revoke --confirm
 *
 * Levels (shared/constants/admin.ts): "owner" can do everything in the admin
 * portal; "moderator" reviews farmers, listings and reports and can restrict
 * or suspend accounts, but can't block accounts, change roles, feature
 * listings, edit reference data or settings, or read the audit log.
 * Re-running with a different --level changes an admin's level.
 *
 * The person must already have signed up (any role) and, outside the
 * emulators, verified their email. They must sign in again afterwards.
 */
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { ADMIN_LEVELS, type AdminLevel } from "../shared/constants/admin.ts";
import { COLLECTIONS } from "../shared/firestore-paths.ts";
import {
  BOOTSTRAP_ACTOR,
  arg,
  fail,
  flag,
  initAdmin,
  usingEmulators,
} from "./lib/admin-app.mts";

const email = arg("email");
const revoke = flag("revoke");
const level = (arg("level") ?? "moderator") as AdminLevel;
if (!email)
  fail(
    "Usage: npm run admin:grant -- --email you@example.com [--level owner|moderator] [--revoke] --confirm",
  );
if (!revoke && !(ADMIN_LEVELS as readonly string[]).includes(level))
  fail(`--level must be one of: ${ADMIN_LEVELS.join(", ")}`);

const { app, projectId } = initAdmin();
console.log(`Project: ${projectId}${usingEmulators ? " (emulators)" : ""}`);
console.log(
  revoke
    ? `Revoke admin from: ${email}`
    : `Grant admin (${level}) to: ${email}`,
);
if (!flag("confirm")) fail("Nothing changed. Re-run with --confirm to apply.");

const auth = getAuth(app);
const db = getFirestore(app);

const user = await auth
  .getUserByEmail(email)
  .catch(() => fail(`No account with email ${email}. Sign up first.`));
if (user.disabled || user.customClaims?.blocked)
  fail("This account is blocked. Unblock it first.");
if (!revoke && !usingEmulators && !user.emailVerified) {
  fail(
    "Email not verified. Verify it (link sent at sign-up) before granting admin.",
  );
}

const claims = { ...user.customClaims };
const userRef = db.collection(COLLECTIONS.users).doc(user.uid);

const previousLevel = claims.adminLevel;
if (revoke) {
  if (claims.role !== "admin") fail("This account is not an admin.");
  claims.role = "consumer";
  delete claims.adminLevel;
} else {
  if (claims.role === "admin" && claims.adminLevel === level) {
    console.log(`Already an admin (${level}). Nothing to do.`);
    process.exit(0);
  }
  claims.role = "admin";
  claims.adminLevel = level;
}

await auth.setCustomUserClaims(user.uid, claims);

const batch = db.batch();
const existing = await userRef.get();
batch.set(
  userRef,
  existing.exists
    ? { role: claims.role, updatedAt: FieldValue.serverTimestamp() }
    : {
        role: claims.role,
        status: "active",
        displayName: user.displayName || email.split("@")[0],
        email,
        preferredLocale: "en",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
  { merge: true },
);
batch.set(db.collection(COLLECTIONS.adminLogs).doc(), {
  actorId: BOOTSTRAP_ACTOR,
  action: revoke ? "admin.revoke" : "admin.grant",
  targetType: "user",
  targetId: user.uid,
  details: revoke
    ? { previousLevel: previousLevel ?? null }
    : { level, previousLevel: previousLevel ?? null },
  createdAt: FieldValue.serverTimestamp(),
});
await batch.commit();

// End existing sessions so the new role applies on next sign-in.
await auth.revokeRefreshTokens(user.uid);
console.log(
  `✔ Done. ${email} is now ${claims.role}${revoke ? "" : ` (${level})`}. They must sign in again.`,
);
