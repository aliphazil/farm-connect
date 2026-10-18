# Deployment, backup and rollback

The launch runbook for FarmConnect Maldives. Console steps marked **(you)**
can only be done by the project owner. Nothing here has been run against a
real Firebase project yet; the app has only been tested on the local
emulators.

Never commit `.env.local`, service-account JSON files or real values. All
examples below are placeholders.

## 1. Local development

Requirements: Node ≥ 24.12 (`node -v`), Java 21 for the emulators
(`brew install openjdk@21`), Git.

```bash
git clone https://github.com/aliphazil/farm-connect.git
cd farm-connect
npm install
cp .env.example .env.local      # then edit; see section 3
```

Without a Firebase project, use the emulators:

```bash
npm run emulators                       # terminal 1 (UI on http://localhost:4000)
# .env.local: uncomment the emulator block, NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true
npm run seed:reference -- --confirm     # categories, units, atolls, sample islands
npm run dev                             # terminal 2 → http://localhost:3000
```

Checks before any deploy:

```bash
npm run format:check && npm run lint && npm run typecheck && npm test
npm run test:emulator                   # rules, storage rules, server and security tests
CATALOG_SOURCE=sample npm run build     # production build with sample data
```

## 2. Firebase project setup (you)

Follow [firebase-setup.md](firebase-setup.md) sections 1–2: create the
project, Blaze plan, region (e.g. `asia-south1`), email/password sign-in,
Firestore in production mode, Storage, a web app. Also:

- **Authentication → Settings → Authorized domains**: add your production
  domain(s) and the App Hosting domain. Remove `localhost` once you no
  longer develop against this project.
- **Authentication → Templates**: set the sender name and the password-reset
  email language; optionally a custom action URL on your domain.
- **App Check** (recommended before launch): register reCAPTCHA Enterprise
  for the web app, monitor, then enforce for Firestore, Storage and Auth.
- **Budget alert**: Google Cloud console → Billing → Budgets, e.g. at 50%
  and 90% of what you expect to spend.

## 3. Environment variables

| Name                                       | Secret? | Where                         | Example (placeholder)                 |
| ------------------------------------------ | ------- | ----------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | no¹     | build + runtime               | `your-web-api-key`                    |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | no      | build + runtime               | `your-project.firebaseapp.com`        |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | no      | build + runtime               | `your-project`                        |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | no      | build + runtime               | `your-project.firebasestorage.app`    |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | no      | build + runtime               | `000000000000`                        |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | no      | build + runtime               | `1:000000000000:web:0000000000000000` |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS`       | no      | local only                    | `false` in production                 |
| `CATALOG_SOURCE`                           | no      | build + runtime               | `firestore` in production             |
| `FIREBASE_ADMIN_PROJECT_ID`                | no      | runtime (not on App Hosting²) | `your-project`                        |
| `FIREBASE_ADMIN_CLIENT_EMAIL`              | **yes** | runtime (not on App Hosting²) | `firebase-adminsdk-xxx@…`             |
| `FIREBASE_ADMIN_PRIVATE_KEY`               | **yes** | runtime (not on App Hosting²) | `-----BEGIN PRIVATE KEY-----\n…`      |

¹ Firebase web config is public by design; protection comes from Security
Rules, App Check and authorized domains.
² On Firebase App Hosting / Cloud Run leave the three `FIREBASE_ADMIN_*`
values unset: the backend's own service account is used. On other hosts,
store them in the host's secret manager, never in the repository.

## 4. Safe first-admin setup (you)

There is no web endpoint that grants admin rights; registration only offers
buyer or farmer.

1. Register a normal account on the deployed site with the email you'll use
   as administrator, and verify the email.
2. On your own machine, with Admin credentials for the production project in
   `.env.local` (or `gcloud auth application-default login`):

   ```bash
   npm run admin:grant -- --email you@example.com --level owner --confirm
   ```

3. Sign out and back in. The grant is recorded in the audit log.
4. Give other administrators `--level moderator` unless they need owner
   powers (payments verification, roles, settings, branding, audit log).
5. Delete any downloaded service-account key afterwards, or disable it in
   Google Cloud → IAM → Service accounts.

## 5. Deploy Security Rules and indexes (you approve)

Rules and indexes are versioned in `firebase/`. Run the tests first, then:

```bash
npx firebase login
npx firebase use --add                     # select the project, alias "prod"
npm run test:emulator
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project prod
```

- Accept the prompt to let **Storage rules read Firestore** (needed for the
  account-status checks on uploads).
- Indexes take a few minutes to build (Firestore → Indexes). Queries that
  need a building index fail until it's ready.
- The index file also enables a **TTL policy** on `analyticsMarks.expireAt`.
  Confirm under Firestore → Time-to-live; add it there if missing.
- The deploy command asks before deleting indexes that exist only in the
  console. Answer **No** unless you know they're unused.

## 6. Hosting deployment (you approve)

Recommended: **Firebase App Hosting** (Next.js server features, Server
Actions, route handlers and the proxy all work; HTTPS certificates are
automatic).

1. Merge the release into `main` on GitHub.
2. Firebase console → **App Hosting → Create backend**: connect
   `aliphazil/farm-connect`, branch `main`, root `/`, region near your
   Firestore region. Disable automatic rollouts until you're ready if you
   want to approve each release.
3. Add `apphosting.yaml` at the repo root (values are public, so it may be
   committed) — replace every placeholder:

   ```yaml
   runConfig:
     minInstances: 0
   env:
     - variable: NEXT_PUBLIC_FIREBASE_API_KEY
       value: your-web-api-key
     - variable: NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
       value: your-project.firebaseapp.com
     - variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID
       value: your-project
     - variable: NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
       value: your-project.firebasestorage.app
     - variable: NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
       value: "000000000000"
     - variable: NEXT_PUBLIC_FIREBASE_APP_ID
       value: 1:000000000000:web:0000000000000000
     - variable: CATALOG_SOURCE
       value: firestore
   ```

4. Start a rollout. The build reads Firestore (public pages are
   prerendered); App Hosting builds have access through the backend's
   service account.
5. **Custom domain**: App Hosting → your backend → Settings → Domains → Add
   custom domain, then create the DNS records it shows at your registrar.
   The certificate is issued automatically once DNS resolves (can take up to
   24 h). Add the domain to Authentication → Authorized domains.
6. **HTTPS**: App Hosting serves HTTPS only. The app sends
   `Strict-Transport-Security` (1 year, subdomains). Only add `preload`
   once you're sure every subdomain will always be HTTPS.

Post-deploy smoke test (5 minutes): open `/en` and `/dv`; register a test
buyer; search and filter; open a product; as a test farmer create a listing
with a photo; as owner open `/en/admin`, `/en/admin/analytics` and
`/en/admin/payments`; download an invoice PDF; sign out.

## 7. Backup and recovery

**Firestore**

- Enable **point-in-time recovery** (Firestore → Disaster recovery, or
  `gcloud firestore databases update --database='(default)' --enable-pitr`):
  restores any minute of the last 7 days.
- Create a **daily backup schedule** with retention (example: 14 days):

  ```bash
  gcloud firestore backups schedules create --database='(default)' \
    --recurrence=daily --retention=14d
  ```

- Before risky changes (rules overhaul, data scripts), take a manual export:

  ```bash
  gcloud firestore export gs://your-project-backups/$(date +%Y-%m-%d)
  ```

- **Restore** goes into a **new** database, never over the live one:
  `gcloud firestore databases restore --source-backup=… --destination-database=restore-YYYYMMDD`.
  Check the restored data, then copy back only what's needed, or point the
  app at it after review. Do this together with someone who knows the data.

**Cloud Storage** (product photos, logos, payment slips, report evidence,
branding images)

- Enable **soft delete** (default 7 days) or object versioning on the bucket.
- Optional nightly copy to a backup bucket in another region:
  `gcloud storage rsync -r gs://your-project.firebasestorage.app gs://your-project-backups-media`.

**Authentication** accounts: export periodically with
`npx firebase auth:export users.json --project prod` and store the file
encrypted (it contains password hashes and emails).

Test a restore into a scratch database at least once before launch.

## 8. Rollback

- **App**: App Hosting → backend → Rollouts → choose the last good rollout →
  **Roll back**. This is instant and doesn't touch data. Alternatively
  revert the commit on `main` and roll out again.
- **Security Rules**: rules are in git. Check out the previous version of
  `firebase/firestore.rules` / `firebase/storage.rules` and deploy only
  rules:

  ```bash
  git checkout <last-good-commit> -- firebase/firestore.rules firebase/storage.rules
  npx firebase deploy --only firestore:rules,storage --project prod
  ```

  The console (Firestore → Rules → history) can also republish an older
  version.

- **Indexes**: deploying an older index file doesn't remove newer indexes
  unless you confirm deletion; leaving extra indexes is harmless.
- **Data**: use point-in-time recovery or a backup as in section 7 — into a
  new database first.
- **Branding**: Admin → Branding studio → history → Restore, then Publish.

Keep a short release log (date, commit, who approved, rules changed y/n) so
you know what to roll back to.
