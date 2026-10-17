# Product search

## What runs today (Firestore only)

Live search (`CATALOG_SOURCE=firestore`) is implemented in
`src/features/catalog/search.ts`. It runs on the server with the Admin SDK and
never downloads the products collection to the browser.

| Filter                   | Where it runs                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------- |
| Public only              | Firestore: `isPublic == true` (derived field, checked by Security Rules)            |
| Available now            | Firestore: `status == "active"`; future `availableFrom` dates are dropped in memory |
| Category                 | Firestore: `category ==`                                                            |
| Atoll / island           | Firestore: `location.atollCode ==` or `location.islandId ==`                        |
| Name (English / Dhivehi) | Firestore: `searchTokens array-contains <first word>`; other words in memory        |
| Delivers to atoll        | Firestore: `deliveryAtolls array-contains` (in memory if a search word is used)     |
| Price range              | Firestore when sorting by price; in memory when sorting by newest                   |
| Sort                     | Firestore: `createdAt desc`, or `priceLaari asc/desc, createdAt desc`               |

- Firestore allows only one `array-contains` per query, so a search word takes
  priority and the delivery atoll is then checked in memory.
- Paging uses a cursor (`?after=<productId>`). Each request scans at most 240
  documents, so a page can come back short when most candidates are filtered
  out in memory. The page then offers "More results".
- An exact count is shown only when every filter ran inside Firestore.

### How name matching works

`searchTokens` is computed from the English and Dhivehi titles whenever a
product is saved (`shared/search.ts`). Text is lower-cased with accents
removed, split into words, and each word stored as prefixes of 2–15
characters (at most 80 tokens). A query matches when **every** query word is
a prefix of some word in the title: "tom" finds "Tomatoes", and "ބަނބު" finds
any title containing a word starting with it.

This is **not full-text search**:

- no typo tolerance ("tomatos" won't match),
- no stemming, synonyms or transliteration (a Latin "mirus" won't find "މިރުސް"),
- descriptions aren't searched,
- no relevance ranking: results follow the chosen sort.

### Indexes

`firebase/firestore.indexes.json` declares one composite index per filter
field (`isPublic`, `status`, `category`, `location.islandId`,
`location.atollCode`, `searchTokens`, `deliveryAtolls`), each paired with
each sort order. Firestore merges these for equality and `array-contains`
combinations, so not every combination needs its own index.

If a production query still needs an index, it fails with
`FAILED_PRECONDITION` and a console link to create it. The products page
shows its error state. Deploy indexes with:

```sh
firebase deploy --only firestore:indexes
```

The emulator doesn't enforce indexes, so check new filter combinations
against a real project before launch.

## Proposal: a search service for full-text needs

When typo tolerance, relevance ranking or description search is needed, add
a dedicated search engine and keep Firestore as the source of truth.

| Option                      | Fit                                                                             | Notes                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Typesense** (recommended) | Official Firebase extension syncs a collection; typo tolerance, filters, facets | Self-host or Typesense Cloud (has a free tier). Supports any Unicode text, including Thaana. |
| Algolia                     | Mature hosted service with a Firebase extension                                 | Pricing is per record and per search; check costs at scale.                                  |
| Meilisearch                 | Simple, typo-tolerant, open source                                              | No official Firebase extension: sync with a Cloud Function.                                  |

Suggested design:

1. Sync only **public** products, keeping the same `isPublic` rule. The
   extension or a Cloud Function removes a document from the index when it
   stops being public.
2. Index `title.en`, `title.dv`, `description.*`, plus `category`,
   `location.*`, `deliveryAtolls`, `priceLaari`, `status`, `availableFrom` and
   `createdAt` for filtering and sorting.
3. Query from the server, or give the browser a scoped **search-only** key
   restricted to `isPublic:true`. Admin keys must never reach the browser.
4. Keep `search.ts` as the fallback when the service is unavailable.

Needs a decision from the project owner (cost and hosting) before it is
implemented.
