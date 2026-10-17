import type { Dictionary } from "@shared/i18n";
import type { LocationLabels } from "./location-picker";

/** The strings LocationPicker needs, taken from the dictionary. */
export function locationLabels(dict: Dictionary): LocationLabels {
  return { ...dict.location, required: dict.common.required };
}
