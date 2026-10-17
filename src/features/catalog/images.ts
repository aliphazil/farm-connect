/**
 * Public URL for a Cloud Storage object whose rules allow public reads
 * (product photos, farm logos). Works on the server and in the browser.
 * Uses the Storage emulator when configured.
 */
export function storageObjectUrl(path: string): string {
  const bucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-farmconnect"}.appspot.com`;
  const emulator =
    process.env.FIREBASE_STORAGE_EMULATOR_HOST ||
    (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true"
      ? "127.0.0.1:9199"
      : "");
  const origin = emulator
    ? `http://${emulator}`
    : "https://firebasestorage.googleapis.com";
  return `${origin}/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}

/** Local emulator images can't go through Next's image optimiser. */
export function isUnoptimizedImage(src: string): boolean {
  return (
    src.startsWith("http://127.0.0.1") || src.startsWith("http://localhost")
  );
}
