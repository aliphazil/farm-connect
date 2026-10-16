import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = join(__dirname, "../../app/[locale]");

const GUARDS = {
  farmer: "requireFarmerPortal",
  buyer: "requireBuyerPortal",
  admin: "requireAdminPortal",
} as const;

function pageFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return pageFiles(path);
    return /^page\.(tsx|ts|jsx|js)$/.test(name) ? [path] : [];
  });
}

describe("portal pages", () => {
  for (const [portal, guard] of Object.entries(GUARDS)) {
    const pages = pageFiles(join(APP_DIR, portal));

    it(`${portal} portal has pages`, () => {
      expect(pages.length).toBeGreaterThan(0);
    });

    for (const page of pages) {
      it(`${page.slice(APP_DIR.length)} awaits ${guard}()`, () => {
        expect(readFileSync(page, "utf8")).toMatch(
          new RegExp(`await\\s+${guard}\\(\\)`),
        );
      });
    }
  }
});
