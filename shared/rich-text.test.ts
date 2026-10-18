import { describe, expect, it } from "vitest";
import {
  isInternalPath,
  parseRichText,
  safeExternalUrl,
  safeHref,
  unsafeLinks,
} from "./rich-text";

describe("links", () => {
  it("accepts https and internal paths only", () => {
    expect(safeExternalUrl("https://example.mv/about")).toBe(
      "https://example.mv/about",
    );
    expect(safeExternalUrl("http://example.mv")).toBeNull();
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
    expect(safeExternalUrl("https://user:pw@example.mv")).toBeNull();
    expect(safeExternalUrl("https://localhost")).toBeNull();
    expect(safeExternalUrl("https://exa mple.mv")).toBeNull();
    expect(isInternalPath("/en/products?q=x")).toBe(true);
    expect(isInternalPath("//evil.example")).toBe(false);
    expect(isInternalPath("/\\evil")).toBe(false);
    expect(safeHref(" /en/help ")).toBe("/en/help");
  });
});

describe("rich text", () => {
  it("parses paragraphs, line breaks, bold and safe links into tokens", () => {
    expect(
      parseRichText("Hello **farmers**\nsee [help](/en/help)\n\nSecond"),
    ).toEqual([
      [
        { type: "text", text: "Hello " },
        { type: "bold", text: "farmers" },
        { type: "break" },
        { type: "text", text: "see " },
        { type: "link", text: "help", href: "/en/help" },
      ],
      [{ type: "text", text: "Second" }],
    ]);
  });

  it("never produces HTML: tags stay text, unsafe links stay text", () => {
    const out = parseRichText(
      "<script>alert(1)</script> [x](javascript:alert(1)) <img src=x onerror=1>",
    );
    expect(
      out.flat().every((t) => t.type === "text" || t.type === "break"),
    ).toBe(true);
    expect(
      unsafeLinks("[a](https://ok.mv) [b](javascript:x) [c](http://plain.mv)"),
    ).toEqual(["javascript:x", "http://plain.mv"]);
  });
});
