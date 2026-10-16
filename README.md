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

The site runs without Firebase credentials; portal pages will simply redirect to sign-in.

| Script              | What it does                                           |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Development server                                     |
| `npm run build`     | Production build                                       |
| `npm run check`     | Lint + type-check + unit tests                         |
| `npm run format`    | Format with Prettier                                   |
| `npm run emulators` | Firebase Auth/Firestore/Storage emulators (needs Java) |

## Project layout

```
shared/                  Framework-free code, reusable by a future Expo app
  constants/             locales, roles, atolls & islands, categories & units
  schemas/               Zod schemas = domain types (User, Farmer, Listing, Enquiry,
                         Invoice, PaymentRecord, FraudReport, Branding, AuditLog)
  i18n/                  en.json / dv.json dictionaries
  utils/                 MVR money (integer laari), Maldivian phone numbers
  firestore-paths.ts     collection names & Storage paths
src/
  proxy.ts               locale redirect (/ → /en or /dv). Not an auth layer.
  i18n/                  getLocale()/getDictionary() for Server Components, path helpers
  lib/firebase/          client.ts (browser SDK), admin.ts (server-only Admin SDK)
  lib/auth/              session.ts (session-cookie DAL), portal-access.ts (portal guards)
  components/ui/         Button, form fields, Alert, EmptyState, Spinner, Card, Badge…
  components/layout/     header, footer, locale switcher, mobile nav, portal shell
  app/[locale]/          (public) home & marketplace · (auth) login/register ·
                         farmer/ · buyer/ · admin/
firebase/                firestore.rules, storage.rules, firestore.indexes.json
```

## Security model

- **Roles** (`buyer`, `farmer`, `admin`) and `blocked` are Firebase Auth **custom claims**, set only by
  server code with the Admin SDK.
- **Sessions** use a Firebase session cookie named `__session` (the only cookie Firebase Hosting forwards),
  verified with revocation checks on every request (`src/lib/auth/session.ts`).
- **Portal pages** each call their guard (`requireFarmerPortal()` etc.). Layout-level checks are not
  enough with partial prerendering — a test fails if a portal page forgets its guard.
- **Server Actions / Route Handlers** must call `assertRole()` themselves.
- **Security Rules** deny by default. Clients may only write their own farm profile and listings (with
  field validation); everything privileged is written by server code.
- `NEXT_PUBLIC_FIREBASE_*` values are public by design. `FIREBASE_ADMIN_*` values are secrets.

## Conventions

- Money is stored as **integer laari** (1 MVR = 100). Use `formatMVR` / `parseMVR`.
- Phone numbers are stored as E.164 (`+9607771234`). Use `mvPhoneSchema` / `normalizeMvPhone`.
- A schema's `id`/`uid` is the Firestore document id and is not stored in the document.
- Use logical CSS utilities (`ms-`, `me-`, `ps-`, `start-`, `text-start`) so layouts work in RTL.
- Add every UI string to **both** `shared/i18n/en.json` and `dv.json` (a test enforces matching keys).

## Before launch — needs human review

- **Dhivehi text** in `shared/i18n/dv.json` and `DEFAULT_BRANDING` needs review by a native speaker.
- **Atoll names / island list** in `shared/constants/geography.ts` should be checked against official
  sources; the full inhabited-island list will be managed in Firestore.
- **Security Rules are not yet tested** — emulator tests need Java and Node ≥ 24.12
  (`@firebase/rules-unit-testing@6`).
