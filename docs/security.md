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
- **Blocking**: sets the `blocked` claim, revokes refresh tokens, marks
  `users/{uid}.status = "blocked"`, hides the farm and its products, and logs
  the action. Rules also check `users.status` on writes, because a token's
  claims can lag up to an hour.
  - Since the trust & safety phase, blocking **doesn't disable Firebase
    sign-in**, so a blocked person can sign in to the `/appeal` page, read the
    reason and appeal. They still get no session (`/api/auth/session` returns
    `account_blocked`), and every write is refused by rules (blocked claim and
    status) and by server code.
  - Invoices, payments, enquiries, reports, products and audit records are
    kept; nothing is deleted.

## Trust & safety

- **Reports** are created only by server code (`src/services/server/reports.ts`);
  clients can't write them.
  - _Who may report what_: buyers report farms and listings; farmers report
    buyers through an enquiry they received; anyone may report an account
    they've dealt with (shared enquiry). Nobody can report themselves or an
    administrator. The server resolves the reported account.
  - _Duplicates_: one open report per reporter and subject (a guard document
    created in the same transaction, released when the report closes).
  - _Rate limit_: 5 reports per reporter per 24 hours.
  - _Abuse_: suspended, blocked and report-restricted accounts can't report.
  - _Evidence_: up to 3 images/PDFs of 5 MB in `reportEvidence/{uid}/`,
    write-once, readable only by the reporter and admins. The server checks
    each path is the reporter's own and that the type and size are allowed.
    Admins open files through `/api/admin/report-evidence`, which sends
    `nosniff` and a sandboxing CSP.
- **Privacy**: the reported party can never read a report. Internal admin
  notes are in an admin-only subcollection. Messages to the reporter are in
  a subcollection only the reporter and admins can read. Reasons shown to
  the reported user are written separately and the form says not to mention
  the reporter.
- **Enforcement records** (`enforcementActions`): warning, restriction,
  suspension and block, each with the user-facing reason, an admin-only
  note, the administrator, dates, expiry and the appeal. They're readable
  only by admins; users see their own through server code that leaves out
  internal fields.
- **Appeals**: users appeal from `/account/notices`, or from `/appeal` when
  locked out.
  - `/api/appeals` authenticates with a fresh-verified ID token and only
    touches the caller's own records. There's one appeal per action.
  - Owners can close appeals, and can allow admins to pause the appeal on a
    specific action during an investigation, with a reason the user sees.
  - Deciding an appeal against a block needs an owner.

## Invoices and payment ledger

- FarmConnect records payments made directly between buyers and farmers; it
  doesn't process payments or verify transfers automatically. No payment
  gateway is integrated.
- All financial writes are server-side (`src/services/server/finance.ts`);
  rules deny client writes to orders, invoices, payments, receipts, counters
  and number guards. Only the owning, active farmer can change their records.
- Names, units and agreed prices are snapshotted on the transaction and copied
  to the invoice, so listing edits never change history.
- Invoice and receipt numbers come from a per-farmer counter, guarded by a
  global `documentNumbers/{number}` document created in the same
  transaction, so a number can never be issued twice.
- Amount paid, outstanding balance and status are recomputed from the
  ledger in every ledger transaction; the stored `paidLaari` is only a cache
  (a tampered cache doesn't change what the invoice view or PDF shows).
- The ledger is append-only. Corrections are reversals (the original stays,
  marked reversed) or refunds. Farmers can't reverse verified entries.
- "Verified" can only be set by an administrator with `payments.verify`, and
  only for a transfer awaiting verification that has a slip or a reference.
  Admin views of other people's invoices, receipts and slips are logged
  (`finance.view`).
- Buyers see their own issued invoices, payments and receipts, never drafts.

## Branding Studio

- Only owner-level admins (`branding.manage`) can save, preview, publish,
  restore or discard branding, checked in the Server Action and again in the
  service (`src/services/server/branding.ts`). Moderators and members are
  refused; the preview route checks the same permission.
- The public site reads only the published config. Drafts and version
  history are admin-only collections, so a draft can't leak to visitors.
- The config has a fixed, validated shape (`shared/schemas/branding.ts`):
  hex colours with contrast checks, fonts and styles from approved lists,
  internal paths or https links, social links limited to each platform's
  domains. Theme values reach the page only as CSS variables built from
  those validated values (`src/lib/branding/theme.ts`).
- Rich text is a tiny markup (paragraphs, bold, links) rendered as React
  elements; no HTML from the editor is ever injected, and unsafe links
  (javascript:, data:, http:) are shown as plain text.
- Uploads: owner admins only, PNG/JPEG/WebP (ICO for the favicon), no SVG,
  size-limited and write-once (Storage rules); the server re-checks type
  and size of every referenced file on save and publish.
- Roles, credentials, payment verification and other security settings
  aren't part of the branding config. Every draft save, publish, restore
  and discard is in `adminLogs`.

## Marketplace analytics

- Browsers can't write analytics data: events go to `/api/events`
  (same-origin only, small validated batches, bots ignored, rate-limited per
  hashed network address and per browser id) and are aggregated with the
  Admin SDK (`src/services/server/analytics.ts`). Security Rules refuse
  every client write to the analytics collections, including the legacy
  `siteEvents`.
- The server never trusts ids it can derive: a product view must name a
  public product, and the farmer, category and island are read from the
  product. A farmer can't credit another farmer's listing with views.
- No raw events, visitor ids, search words or IP addresses are stored. A
  random browser id (local storage, not a cookie, not linked to an account)
  is hashed into day-scoped duplicate markers that expire after 3 days (TTL
  policy), and into HyperLogLog registers that keep no identifier.
- Admin browsing isn't counted; farmers' views and clicks on their own
  listings aren't counted.
- Aggregates are readable by admins with `analytics.view` (owner and
  moderator). Farmers see only their own figures, read on the server and
  filtered by the session uid; they can't read counters directly.
- Enquiries, registrations, invoices, payments and reports on the dashboards
  come from those records, not from browser events. A contact click is
  never shown as a contact, and a payment record never as a verified
  payment.

## Pre-launch audit (Prompt 11, 2026-10-18)

Reviewed: every Firestore and Storage rule, all 8 API routes, all 41 Server
Actions, the services they call, environment handling, dependencies and git
history. Tested on the emulators; nothing was run against production.

Fixed:

- **Farm address and map pin were publicly readable.** `farmerProfiles`
  allowed anyone to read approved profiles directly from Firestore, and the
  document holds the private address and map pin (shown only to the owner
  and admins in the app). Reads are now owner/admin only; the public site
  already builds farm pages on the server from the public fields. No data
  was moved.
- **Request ids could address other paths.** Ids from requests went straight
  into `.doc(id)`, where `a/b/c` reaches a subcollection. Not exploitable
  today (ownership checks failed on such documents), but `col()` now accepts
  only single document ids (`InvalidIdError`), and detail pages and PDF
  routes answer 404 for crafted ids.
- **Missing security headers.** Added `Strict-Transport-Security` and a CSP
  with `frame-ancestors 'none'; base-uri 'self'; object-src 'none';
form-action 'self'`.
- **Location button blocked by our own header.** `Permissions-Policy:
geolocation=()` disabled the farm profile's "use my current location";
  now `geolocation=(self)`.

Checked and found sound: role and admin-level checks on every action and
route (`tests/integration/security-audit.test.ts` calls every action as
each role it must refuse); registration can't choose admin; admin grants
only through `scripts/grant-admin.mts`; suspended/blocked accounts get no
session and can't write; payment verification is admin-only with evidence;
uploads are type/size/path-checked in rules and re-checked on the server;
privileged mutations are audit-logged; no secrets in tracked files or git
history.

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

| #   | Issue                                                                                                                                                    | Risk                                                                    | Mitigation / next step                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Anyone can post analytics events to `/api/events` (same-origin check is a browser control, not a barrier for scripts)                                    | Inflated traffic figures                                                | Validation, per-day de-duplication, rate limits; add App Check before launch                           |
| 2   | No App Check on Auth / Firestore / Storage generally                                                                                                     | Scripts can call the APIs directly (still bound by rules)               | Enable App Check before launch                                                                         |
| 3   | Product and farm-logo images are publicly readable by path, even for draft products                                                                      | Low: images only                                                        | Accept, or move drafts under a private path                                                            |
| 4   | Farmer contact numbers in public farm profiles                                                                                                           | By design (direct contact)                                              | Shown in the privacy policy; farmers choose what to add                                                |
| 5   | Role claim changes take effect on next sign-in (sessions are revoked on role change/block)                                                               | Brief lag only for unblock/approve                                      | Acceptable                                                                                             |
| 6   | Email verification isn't required to use the site                                                                                                        | Fake emails can register                                                | Required for admin grant; consider requiring it for farmers before approval                            |
| 7   | Sign-in rate limiting relies on Firebase Auth's built-in protection                                                                                      | Brute-force on weak passwords                                           | Enable reCAPTCHA/App Check for Auth; consider password policy in console                               |
| 8   | Storage rules tests not run in CI yet                                                                                                                    | Rules regressions                                                       | Run `npm run test:storage-rules` locally; add CI                                                       |
| 9   | Island list is a seed of capitals + farming islands                                                                                                      | Farmers on other islands can't register a precise location              | Expand `islands` collection (admin tool in a later phase)                                              |
| 10  | Analytics rate limits are per server instance and in memory                                                                                              | A distributed flood can still add some counts                           | De-duplication caps each browser id; App Check; watch for spikes                                       |
| 11  | Photos uploaded during a product save that then fails stay in Storage                                                                                    | Storage cost only                                                       | Periodic cleanup of objects not referenced by `products.imagePaths`                                    |
| 12  | Photos of draft products are readable by URL (paths are unguessable but public)                                                                          | Low                                                                     | Accept, or move drafts to a private path                                                               |
| 13  | A farmer can stuff extra words into a product title to appear in more searches                                                                           | Search spam (titles are public and reportable)                          | Report action on every listing; admin removal; ranking in a future search service                      |
| 14  | Unique visitors are per browser; clearing data, private windows and other devices count as new visitors. Ranges use a HyperLogLog estimate (~1.6% error) | Visitor figures are approximate                                         | Labelled on the dashboard (exact for single days)                                                      |
| 15  | A contact click only means the buyer opened their phone/chat app                                                                                         | Could be mistaken for a delivered message or sale                       | Dashboard hint says so; no "sent"/"sold" status is derived from clicks                                 |
| 16  | Moderators can see private profile details (address, map pin, buyer preferences) needed for review                                                       | Insider misuse                                                          | Grant moderator access sparingly; every action is logged; consider masking in a later phase            |
| 17  | With pre-approval on, edits to an already-approved listing don't go back to review                                                                       | Bait-and-switch after approval                                          | Reports + audit history; optionally re-review on title/photo changes                                   |
| 18  | Disabling a category/unit hides it from new listings only (not enforced in rules)                                                                        | A crafted client could still use it                                     | Ids remain valid values; enforce in rules if needed                                                    |
| 19  | Report rate limit is per account; someone with many accounts can still flood reports                                                                     | Review workload                                                         | Admin triage (assignment, dismissal); App Check; per-target limits later                               |
| 20  | Evidence files that fail server checks, or are never attached, stay in Storage                                                                           | Storage cost only                                                       | Periodic cleanup of unattached `reportEvidence/` objects                                               |
| 21  | Evidence isn't scanned for malware                                                                                                                       | An admin could open a harmful PDF                                       | Served sandboxed with nosniff; add a scanning step (e.g. Cloud Functions + a scanner) before launch    |
| 22  | A blocked person can still sign in to Firebase (for appeals) and read their own private records and public data                                          | Low (no writes)                                                         | Intended trade-off; disable sign-in manually in the console for extreme cases                          |
| 23  | Reasons shown to reported users are free text; an admin could still mention the reporter                                                                 | Reporter exposure                                                       | UI warning on the field; admin training; review in audit log                                           |
| 24  | Seller-recorded cash payments can't be independently verified                                                                                            | A dishonest seller could record payments that didn't happen             | Shown as "Recorded by seller"; buyers see every entry and can report                                   |
| 25  | Tax (e.g. GST) isn't calculated or shown                                                                                                                 | Invoices may not meet a registered business's tax obligations           | Needs legal/tax validation before tax fields are added                                                 |
| 26  | Dhivehi text in PDFs is laid out right-to-left without full OpenType shaping                                                                             | Some vowel-mark positions may differ from browser rendering             | Checked visually; the print page (browser rendering) is the reference                                  |
| 27  | Uploaded branding images (including unpublished drafts) are publicly readable by URL                                                                     | Low: unguessable names                                                  | Accept, or serve drafts from a private path                                                            |
| 28  | The published config is cached ("branding" tag, refreshed on publish); the proxy's language setting is cached for up to a minute per server instance     | A publish can take up to a minute to affect language routing            | Acceptable                                                                                             |
| 29  | Admins can't add new fonts or free CSS — only the approved lists                                                                                         | By design ("within approved design limits")                             | Add fonts in code when needed                                                                          |
| 30  | Analytics counting started with Phase 10; older `siteEvents` aren't included or migrated                                                                 | Earlier activity missing from charts                                    | Legacy events stay readable by admins                                                                  |
| 31  | Search words aren't stored, so there is no "top searches" list                                                                                           | Less insight into demand                                                | Only counts and no-result counts are kept (privacy)                                                    |
| 32  | Duplicate markers rely on a Firestore TTL policy on `analyticsMarks.expireAt`                                                                            | Without it, markers accumulate (storage cost)                           | Deploy the index file (fieldOverrides) or set the TTL policy in the console                            |
| 33  | A visitor's "new day"/"new session" flags come from the browser                                                                                          | A script can create extra sessions with fresh ids                       | Rate limits; each id is counted once                                                                   |
| 34  | The CSP doesn't restrict scripts yet (needs per-request nonces with Next.js)                                                                             | An XSS bug would not be contained by CSP                                | React escapes output and no editor content is rendered as HTML; add a nonce-based `script-src` later   |
| 35  | `npm audit`: 4 high findings in production deps, all from `@grpc/grpc-js@1.9.16` inside the latest `firebase` web SDK                                    | The advisories affect gRPC servers; the browser bundle doesn't use gRPC | Update `firebase` when it ships a newer gRPC; `npm audit fix --force` would downgrade Firebase (worse) |
| 36  | A farmer can delete photos of their own listing after an admin removed it                                                                                | Evidence could be lost                                                  | Admins can record notes; consider denying photo deletes when the listing is removed                    |
| 37  | Active delivery areas of hidden or blocked farms stay publicly readable                                                                                  | Low: fees and atolls only                                               | Filter by farm visibility, or read through the server                                                  |
| 38  | Farmer finance operations are recorded on the documents (who, when, reason) rather than in the admin audit log                                           | Less central history                                                    | Acceptable; add a farmer activity log if needed                                                        |

### Buyer portal (consumer phase)

- Buyer pages read the signed-in user's own records on the server, always filtered by the verified session uid (`src/services/server/consumer.ts`); Security Rules independently restrict enquiries, invoices, payments and reports to their parties.
- Saved items resolve through the public catalog, so a product or farm that is hidden later shows as "no longer available" without exposing its details. The admin who handled a report is not shown to the reporter.
- Sign-in return links (`?next=`) accept only same-site `/en` or `/dv` paths.

### Fixed in the farmer-portal phase

- **Payment proofs could be overwritten**: an overwrite was evaluated as a create, so the "no update" rule didn't apply. Rules now require `resource == null` (covered by `tests/rules/storage.rules.test.ts`).
- **Product image paths could reference other farmers' files**: rules now require every `imagePaths` entry to be inside `products/{uid}/{productId}/`.
- **Writes failed right after a page load**: the browser SDK restores the signed-in user asynchronously; services now wait for `authStateReady()` and show "session expired" if there's no user.
- **Build failed on an empty database**: detail routes now return a placeholder static param when there are no products/farms yet.
