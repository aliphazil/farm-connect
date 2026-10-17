# FarmConnect Maldives

Online marketplace connecting Maldivian farmers and buyers. English and Dhivehi (RTL), MVR currency,
atoll/island locations, direct buyer→farmer contact. No online payment processing in the first release.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 ·
Firebase Auth / Firestore / Storage · Zod 4 · Vitest.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in values — never commit .env.local
npm run dev                  # http://localhost:3000
```

Without Firebase configuration the site runs with sample catalog data (`CATALOG_SOURCE=sample`; set `firestore` for live data) and sign-in reports that it isn't
available yet. To connect Firebase (console steps, rules deployment, first admin, hosting) follow
**[docs/firebase-setup.md](docs/firebase-setup.md)**.

| Script                       | What it does                                                                      |
| ---------------------------- | --------------------------------------------------------------------------------- |
| `npm run dev`                | Development server                                                                |
| `npm run build`              | Production build                                                                  |
| `npm run check`              | Lint + type-check + unit tests                                                    |
| `npm run test:emulator`      | Firestore rules + server service tests on the emulators (needs Java)              |
| `npm run test:storage-rules` | Storage rules tests (needs `npx firebase setup:emulators:storage`)                |
| `npm run emulators`          | Auth/Firestore/Storage emulators + UI on :4000                                    |
| `npm run seed:reference`     | Create missing categories/atolls/islands/branding (`-- --confirm`)                |
| `npm run admin:grant`        | Grant/revoke admin (`--level owner\|moderator`) — the only way to create an admin |
| `npm run islands:import`     | Import the official island list from CSV (`-- --file x.csv --confirm`)            |
| `npm run format`             | Format with Prettier                                                              |

## Project layout

```
shared/                  Framework-free code, reusable by a future Expo app
  constants/             locales, roles, atolls & islands, categories & units, branding
  schemas/               Zod schemas = domain types for all 21 collections
  i18n/                  en.json / dv.json dictionaries
  payloads.ts            builders for every client-written document (used by rules tests too)
  firestore-convert.ts   Timestamp → Date, validation on read
  firestore-paths.ts     collection names & Storage paths
src/
  proxy.ts               locale redirect (/ → /en or /dv). Not an auth layer.
  lib/firebase/          client.ts (browser SDK), admin.ts (server-only Admin SDK)
  lib/auth/              session.ts (session-cookie DAL), portal-access.ts (portal guards)
  app/api/auth/          session (sign-in/out cookie) and register (profile + role claim)
  services/server/       privileged Admin-SDK services (registration, admin operations)
  services/client/       browser services for self-service writes (rules-enforced)
  features/auth/         auth flows, error messages, login/register/reset/onboarding forms
  features/admin/        admin Server Actions (assertRole(["admin"]))
  features/catalog/      public catalog (sample data until products are live)
  app/[locale]/          (public) marketplace · (auth) login/register/reset/onboarding ·
                         farmer/ · account/ (consumers) · admin/
firebase/                firestore.rules, storage.rules, firestore.indexes.json
scripts/                 seed-reference-data.mts, grant-admin.mts
tests/                   emulator tests: rules/ and integration/
docs/                    firebase-setup.md, data-model.md, security.md
```

## Security model (summary — details in [docs/security.md](docs/security.md))

- **Roles** (`consumer`, `farmer`, `admin`) and `blocked` are Firebase Auth **custom claims**, set only by
  server code. Registration can only choose `consumer` or `farmer`; admins are granted by
  `scripts/grant-admin.mts` with Admin credentials.
- **Sessions** use an httpOnly `__session` cookie, re-verified with revocation checks on every request.
- **Security Rules** deny by default and are tested on the emulator. Financial, moderation and
  configuration data are server-written only.
- **Portal pages** each call their guard; **Server Actions / Route Handlers** call `assertRole()`.
- `NEXT_PUBLIC_FIREBASE_*` values are public by design. `FIREBASE_ADMIN_*` values are secrets.

## Conventions

- Money is stored as **integer laari** (1 MVR = 100). Use `formatMVR` / `parseMVR`.
- Phone numbers are stored as E.164 (`+9607771234`). Use `mvPhoneSchema` / `normalizeMvPhone`.
- A schema's `id`/`uid` is the Firestore document id and is not stored in the document.
- Clients write through the builders in `shared/payloads.ts` so writes match the tested rules.
- Use logical CSS utilities (`ms-`, `me-`, `ps-`, `start-`, `text-start`) so layouts work in RTL.
- Add every UI string to **both** `shared/i18n/en.json` and `dv.json` (a test enforces matching keys).

## Before launch — needs human review

- **Dhivehi text** in `shared/i18n/dv.json`, `src/content/pages.ts` and branding needs review by a
  native speaker. Terms and privacy text need legal review.
- **Island list**: only capitals and a few farming islands are seeded; expand the `islands` collection.
- **App Check** should be enabled before launch (see docs/security.md).
