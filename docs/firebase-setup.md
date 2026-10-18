# Firebase setup and deployment

This guide connects FarmConnect Maldives to a real Firebase project. Until you
do this, the app runs with sample catalog data and sign-in shows
"Sign-in isn't available on this site yet."

> Nothing in this repository contains real credentials. `.firebaserc` points at
> `demo-farmconnect`, an emulator-only project id that can't touch real data.

## 0. Prerequisites (your machine)

| Tool                     | Why                         | Install                                                                             |
| ------------------------ | --------------------------- | ----------------------------------------------------------------------------------- |
| Node.js ≥ 24.12          | Firebase SDK 13 requires it | `brew install node@24 && brew unlink node && brew link --overwrite --force node@24` |
| Java 21                  | Firebase emulators          | `brew install openjdk@21` (already installed; `~/.zshrc` has the PATH line)         |
| Storage emulator runtime | Storage rules tests         | `npx firebase setup:emulators:storage` (one-time download)                          |

## 1. Console actions (only you can do these)

1. **Create the project** — <https://console.firebase.google.com> → _Add project_.
   Disable Google Analytics unless you need it.
2. **Upgrade to the Blaze plan** — required for Cloud Storage buckets. Set a
   **budget alert** (Google Cloud console → Billing → Budgets) right away.
3. **Authentication** → _Get started_ → _Sign-in method_ → enable
   **Email/Password** (leave _Email link_ off).
   - _Settings → User actions_: keep **Email enumeration protection** ON.
   - _Settings → Authorized domains_: add your production domain later.
   - _Templates_: optionally set the sender name and reply-to for reset/verify emails.
4. **Firestore Database** → _Create database_ → **Production mode** →
   location `asia-south1` (Mumbai, closest to the Maldives). The location
   can't be changed later.
5. **Storage** → _Get started_ → production mode, same region.
6. **Register a web app** → _Project settings → General → Your apps → Web (</>)_.
   Copy the config values into `.env.local` (step 2).
7. **Service account key (local development only)** → _Project settings →
   Service accounts → Generate new private key_. Copy `project_id`,
   `client_email` and `private_key` into `.env.local`, then **delete the JSON
   file**. Never commit it or share it. On Firebase App Hosting / Cloud Run you
   don't need a key at all.

## 2. Environment variables

```bash
cp .env.example .env.local
# edit .env.local with the values from steps 6–7
```

`NEXT_PUBLIC_FIREBASE_*` values are public by design (they identify the
project; Security Rules protect the data). `FIREBASE_ADMIN_*` values are
secrets — they bypass all rules.

## 3. Deploy rules and indexes

```bash
npx firebase login                      # once, opens a browser
npx firebase use --add                  # pick your project, alias it "prod"
npm run test:emulator                   # rules + server tests must pass first
npx firebase deploy --only firestore:rules,firestore:indexes,storage --project prod
```

The Storage rules read `users/{uid}.status` from Firestore. On first deploy
the CLI/console asks you to **grant Storage permission to read Firestore** —
accept it, or uploads will be denied.

Indexes take a few minutes to build (Firebase console → Firestore → Indexes).

The index file also sets a **TTL policy** on `analyticsMarks.expireAt`
(analytics duplicate markers delete themselves after 3 days). If your CLI
version doesn't apply it, add it in the console: Firestore → _Time-to-live_
→ collection group `analyticsMarks`, field `expireAt`.

## 4. Import the official island list

The app never hardcodes islands: atoll/island pickers, filters and labels read
the `islands` collection. Prepare a CSV from an authoritative source (e.g. the
Maldives Bureau of Statistics census list or the Local Government Authority)
with the header `atollCode,nameEn,nameDv` (atoll codes as in
`shared/constants/geography.ts`, e.g. `AA`, `HDH`, `MLE`), then:

```bash
npm run islands:import -- --file islands.csv            # dry run: validates every row
npm run islands:import -- --file islands.csv --confirm  # creates missing islands
# later corrections: add --update to change existing names (nothing is ever deleted)
```

## 4b. Seed reference data

Creates categories, atolls, islands and default branding. Only creates missing
documents; never overwrites or deletes.

```bash
npm run seed:reference -- --confirm
```

For local development only, `--sample-islands` also adds a small sample set
of islands (`shared/constants/sample-islands.ts`). Don't use it in production.

## 5. Create the first administrator (bootstrap)

Admin rights exist **only** as a Firebase Auth custom claim (`role: "admin"`).
Public registration can't create one, no API endpoint can, and editing
`users/{uid}.role` in Firestore does nothing for security. The only way is the
bootstrap script, which needs Admin credentials:

1. Start the app (`npm run dev`) and **register a normal account** with the
   email that should become admin. Click the verification link in the email.
2. Run:
   ```bash
   npm run admin:grant -- --email you@example.com --level owner            # dry run
   npm run admin:grant -- --email you@example.com --level owner --confirm
   # later, for helpers with fewer rights:
   npm run admin:grant -- --email helper@example.com --level moderator --confirm
   ```
3. Sign out and sign in again (the script revokes existing sessions).

The script refuses unverified emails, blocked accounts and emulator-only
project ids against real projects, and records `admin.grant` in `adminLogs`.
Revoke with `--revoke --confirm`. Keep the number of admins small.

## 5b. Switch the marketplace to live data

Set `CATALOG_SOURCE=firestore` for both the **build** and the **runtime**
(public pages are prerendered from the catalog, so the build needs Firestore
access — App Hosting builds have it automatically). With an empty database
the build still succeeds; pages show empty states until farmers publish.

## 6. Hosting

Recommended: **Firebase App Hosting** (supports Next.js server features, uses
the project's own service account, no key needed).

1. Push the repo to GitHub (done: `aliphazil/farm-connect`).
2. Firebase console → _App Hosting_ → _Get started_ → connect the repo, branch `main`.
3. Add the `NEXT_PUBLIC_FIREBASE_*` values as environment variables for the
   backend (`apphosting.yaml` or console). Leave `FIREBASE_ADMIN_*` unset.
4. Add the App Hosting domain to _Authentication → Authorized domains_.

Vercel also works: set all variables in the Vercel project, including the
three `FIREBASE_ADMIN_*` secrets.

## 7. Local development with the emulators (no real project)

```bash
npm run emulators            # terminal 1: Auth, Firestore, Storage + UI on :4000
# terminal 2: .env.local with the emulator block uncommented and
# NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true, NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-farmconnect
npm run seed:reference -- --confirm
npm run dev
```

## 8. Tests

| Command                      | What it runs                                                              |
| ---------------------------- | ------------------------------------------------------------------------- |
| `npm test`                   | Unit tests (schemas, payload builders, filters, i18n, errors)             |
| `npm run test:emulator`      | Firestore rules tests + server service tests (Auth + Firestore emulators) |
| `npm run test:storage-rules` | Storage rules tests (needs the Storage emulator runtime)                  |
