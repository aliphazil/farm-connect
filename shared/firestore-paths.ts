/**
 * Collection names in one place, shared by web, server and a future mobile app.
 * Keep in sync with firebase/firestore.rules.
 *
 * Convention: a schema's `id`/`uid` field is the Firestore document id. It is
 * added by the data-access layer when reading and is not stored in the document.
 */
export const COLLECTIONS = {
  users: "users",
  farmers: "farmers",
  listings: "listings",
  enquiries: "enquiries",
  invoices: "invoices",
  payments: "payments",
  reports: "reports",
  islands: "islands",
  settings: "settings",
  auditLogs: "auditLogs",
} as const;

export const SETTINGS_DOCS = {
  branding: "branding",
} as const;

/** Storage layout. Keep in sync with firebase/storage.rules. */
export const storagePaths = {
  listingImage: (farmerId: string, listingId: string, fileName: string) =>
    `listings/${farmerId}/${listingId}/${fileName}`,
  farmerLogo: (farmerId: string, fileName: string) =>
    `farmers/${farmerId}/${fileName}`,
  brandingAsset: (fileName: string) => `branding/${fileName}`,
};
