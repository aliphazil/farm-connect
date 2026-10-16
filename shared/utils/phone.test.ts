import { describe, expect, it } from "vitest";
import { formatMvPhone, normalizeMvPhone, whatsappLink } from "./phone";

describe("normalizeMvPhone", () => {
  it.each([
    ["7771234", "+9607771234"],
    ["777 1234", "+9607771234"],
    ["777-1234", "+9607771234"],
    ["+960 777 1234", "+9607771234"],
    ["9607771234", "+9607771234"],
    ["009607771234", "+9607771234"],
  ])("normalises %j", (input, expected) => {
    expect(normalizeMvPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "+44 20 7946 0958", "77712345"])(
    "rejects %j",
    (input) => {
      expect(normalizeMvPhone(input)).toBeNull();
    },
  );
});

describe("formatting helpers", () => {
  it("formats for display", () => {
    expect(formatMvPhone("+9607771234")).toBe("777-1234");
  });

  it("builds a WhatsApp link with an encoded message", () => {
    expect(whatsappLink("+9607771234", "Hi there")).toBe(
      "https://wa.me/9607771234?text=Hi%20there",
    );
  });
});
