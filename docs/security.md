# Security model

## Identity and roles

- **Authentication**: Firebase Auth, email/password. The browser keeps the
  Firebase session in IndexedDB (persists across restarts until sign-out).
- **Server session**: after sign-in the browser sends a _fresh_ ID token
  (signed in < 5 minutes ago) to `POST /api/auth/session`, which verifies it
  (with revocation check) and sets an `httpOnly`, `Secure`, `SameSite=Lax`
  cookie `__session` (5 days). Every server request re-verifies the cookie
  with `checkRevoked`, so disabled or revoked accounts lose access immediately.
- **Roles** (`consumer`, `farmer`, `admin`) are **Auth custom claims**, set only
  by server code. Registration (`POST /api/auth/register`) accepts only
  `consumer` or `farmer` (schema-validated) and never replaces an existing role.
- **Admins** are created only by `scripts/grant-admin.mts`, which needs Admin
  credentials. There is no HTTP endpoint that can grant admin or change an
  admin's level, so no administrator can raise their own privileges from the
  website.
- **Admin levels** (`adminLevel` claim, `shared/constants/admin.ts`):
  - _owner_: everything.
  - _moderator_: dashboard and lists, approve/reject farms, restrict and
    suspend accounts, moderate listings, handle reports.
  - Only owners can block or restore blocked accounts, change roles, feature
    listings, edit categories/units/islands, change settings, verify payments
    or read the audit log.
  - A missing or unknown level counts as moderator.
  - Every admin Server Action calls `assertAdminPermission(permission)` against
    the verified session, and the service re-checks the actor (tested in
    `tests/integration/admin-actions.test.ts` with real session cookies).
  - Admins can't act on their own account or on other administrators from
    the app.
- **Suspension** (temporary): sets a `suspendedUntil` claim, revokes sessions,
  marks `users.status = "suspended"` (so rules refuse writes), and hides a
  farmer's farm and products.
  - Sign-in isn't disabled. The session endpoint refuses the account while the
    suspension lasts, and lifts it at the first sign-in after it ends, so no
    scheduled job is needed.
  - Admins can lift ended suspensions in bulk from the dashboard.
- **Restrictions**: `users.restrictions` (enquiries, listings, reports) are
  server-written and enforced by Security Rules (`notRestricted()`).
- **Blocking**: sets the `blocked` claim, disables the Auth user, revokes
  refresh tokens, marks `users/{uid}.status = "blocked"`, hides the farm and
  its products, and logs the action. Rules also check `users.status` on writes,
  because a token's claims can lag up to an hour.

## Authorization layers

1. **Security Rules** (`firebase/*.rules`) — deny by default; enforce ownership,
   allowed fields, enums, sizes and state transitions for every client write.
2. **Server code** — Route Handlers and Server Actions call `assertRole()` /
   `assertAdminPermission()`; admin services re-check the actor and log to
   `adminLogs` (and `moderationActions` with the reason and duration).
   Admin SDK writes bypass rules, so they live only in `src/services/server/`
   and `scripts/`.
3. **Pages** — each portal page calls its guard (`requireFarmerPortal()` etc.);
   a test fails if a portal page forgets. Hiding UI is never relied on.

CSRF: cookie-setting/clearing endpoints require a same-origin `Origin` header;
cookies are `SameSite=Lax`. Registration takes the ID token in the body (not a
cookie), so it isn't CSRF-able.

## What is tested

- `tests/rules/firestore.rules.test.ts` — 36 tests: private profiles, permitted
  fields, admin claim vs. spoofed `users.role`, product publication and
  ownership, enquiry transitions, favourites, reports, financial privacy,
  admin-only collections, reference data, analytics events.
- `tests/integration/server-services.test.ts` — 12 tests: registration (incl.
  admin rejection, duplicate and repair paths), blocking/unblocking with
  product visibility, approval, role changes, payment verification, branding.
- `tests/rules/storage.rules.test.ts` — upload ownership, type, size, file
  name, blocked accounts, private payment proofs (run `npm run test:storage-rules`).

## Known limitations / open items

| #   | Issue                                                                                                     | Risk                                                       | Mitigation / next step                                                                           |
| --- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1   | `siteEvents` accepts anonymous creates                                                                    | Spam writes can raise Firestore costs                      | Enable **Firebase App Check** (reCAPTCHA Enterprise) and enforce it for Firestore; budget alerts |
| 2   | No App Check on Auth / Firestore / Storage generally                                                      | Scripts can call the APIs directly (still bound by rules)  | Enable App Check before launch                                                                   |
| 3   | Product and farm-logo images are publicly readable by path, even for draft products                       | Low: images only                                           | Accept, or move drafts under a private path                                                      |
| 4   | Farmer contact numbers in public farm profiles                                                            | By design (direct contact)                                 | Shown in the privacy policy; farmers choose what to add                                          |
| 5   | Role claim changes take effect on next sign-in (sessions are revoked on role change/block)                | Brief lag only for unblock/approve                         | Acceptable                                                                                       |
| 6   | Email verification isn't required to use the site                                                         | Fake emails can register                                   | Required for admin grant; consider requiring it for farmers before approval                      |
| 7   | Sign-in rate limiting relies on Firebase Auth's built-in protection                                       | Brute-force on weak passwords                              | Enable reCAPTCHA/App Check for Auth; consider password policy in console                         |
| 8   | Storage rules tests not run in CI yet                                                                     | Rules regressions                                          | Run `npm run test:storage-rules` locally; add CI                                                 |
| 9   | Island list is a seed of capitals + farming islands                                                       | Farmers on other islands can't register a precise location | Expand `islands` collection (admin tool in a later phase)                                        |
| 10  | Dashboard view/click counts come from anonymous `siteEvents`, which anyone can create with any `farmerId` | A farmer's counts can be inflated (no data exposure)       | App Check; later aggregate from trusted signals                                                  |
| 11  | Photos uploaded during a product save that then fails stay in Storage                                     | Storage cost only                                          | Periodic cleanup of objects not referenced by `products.imagePaths`                              |
| 12  | Photos of draft products are readable by URL (paths are unguessable but public)                           | Low                                                        | Accept, or move drafts to a private path                                                         |
| 13  | A farmer can stuff extra words into a product title to appear in more searches                            | Search spam (titles are public and reportable)             | Report action on every listing; admin removal; ranking in a future search service                |
| 14  | View/click de-duplication is per browser session (sessionStorage), not per person                         | Counts are indicative, not exact                           | Labelled as such on the dashboard; App Check to limit scripted inflation                         |
| 15  | A contact click only means the buyer opened their phone/chat app                                          | Could be mistaken for a delivered message or sale          | Dashboard hint says so; no "sent"/"sold" status is derived from clicks                           |
| 16  | Moderators can see private profile details (address, map pin, buyer preferences) needed for review        | Insider misuse                                             | Grant moderator access sparingly; every action is logged; consider masking in a later phase      |
| 17  | With pre-approval on, edits to an already-approved listing don't go back to review                        | Bait-and-switch after approval                             | Reports + audit history; optionally re-review on title/photo changes                             |
| 18  | Disabling a category/unit hides it from new listings only (not enforced in rules)                         | A crafted client could still use it                        | Ids remain valid values; enforce in rules if needed                                              |

### Buyer portal (consumer phase)

- Buyer pages read the signed-in user's own records on the server, always filtered by the verified session uid (`src/services/server/consumer.ts`); Security Rules independently restrict enquiries, invoices, payments and reports to their parties.
- Saved items resolve through the public catalog, so a product or farm that is hidden later shows as "no longer available" without exposing its details. The admin who handled a report is not shown to the reporter.
- Sign-in return links (`?next=`) accept only same-site `/en` or `/dv` paths.

### Fixed in the farmer-portal phase

- **Payment proofs could be overwritten**: an overwrite was evaluated as a create, so the "no update" rule didn't apply. Rules now require `resource == null` (covered by `tests/rules/storage.rules.test.ts`).
- **Product image paths could reference other farmers' files**: rules now require every `imagePaths` entry to be inside `products/{uid}/{productId}/`.
- **Writes failed right after a page load**: the browser SDK restores the signed-in user asynchronously; services now wait for `authStateReady()` and show "session expired" if there's no user.
- **Build failed on an empty database**: detail routes now return a placeholder static param when there are no products/farms yet.
