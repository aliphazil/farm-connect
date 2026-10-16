import { notFound } from "next/navigation";

/** Sends unknown URLs under a locale to the localized not-found page. */
export default function CatchAll() {
  notFound();
}
