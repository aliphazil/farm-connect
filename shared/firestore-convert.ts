import type { z } from "zod";

/**
 * Framework-free helpers shared by the browser SDK, the Admin SDK and a future
 * mobile app. They duck-type Firestore Timestamps (anything with `toDate()`)
 * so they work with every Firestore SDK.
 */

type TimestampLike = { toDate: () => Date };

function isTimestampLike(value: unknown): value is TimestampLike {
  return (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as TimestampLike).toDate === "function"
  );
}

/** Recursively converts Firestore Timestamps to Dates. */
export function timestampsToDates(value: unknown): unknown {
  if (isTimestampLike(value)) return value.toDate();
  if (Array.isArray(value)) return value.map(timestampsToDates);
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, timestampsToDates(v)]),
    );
  }
  return value;
}

/**
 * Turns a document's data into a validated domain object. `idField` is the
 * schema field that holds the document id ("id" or "uid").
 */
export function parseDoc<S extends z.ZodType>(
  schema: S,
  id: string,
  data: Record<string, unknown> | undefined,
  idField: "id" | "uid" = "id",
): z.infer<S> {
  if (!data) throw new Error(`Document ${id} does not exist`);
  return schema.parse({
    ...(timestampsToDates(data) as object),
    [idField]: id,
  });
}

/**
 * Removes `undefined` values (Firestore rejects them) from plain objects,
 * recursively. Leaves Dates, arrays' items and SDK sentinels intact.
 */
export function compact<T>(value: T): T {
  if (Array.isArray(value)) return value.map(compact) as T;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, compact(v)]),
    ) as T;
  }
  return value;
}
