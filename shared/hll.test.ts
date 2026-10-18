import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  HLL_REGISTERS,
  emptyHll,
  hllAdd,
  hllEstimate,
  hllFrom,
  hllMerge,
  hllPosition,
} from "./hll";

const h = (s: string) =>
  new Uint8Array(createHash("sha256").update(s).digest());

describe("HyperLogLog", () => {
  it("counts nothing as zero and one visitor as one", () => {
    const r = emptyHll();
    expect(hllEstimate(r)).toBe(0);
    hllAdd(r, h("visitor-1"));
    expect(hllEstimate(r)).toBe(1);
  });

  it("doesn't grow when the same visitor comes back (refreshes)", () => {
    const r = emptyHll();
    expect(hllAdd(r, h("v"))).toBe(true);
    for (let i = 0; i < 50; i++) expect(hllAdd(r, h("v"))).toBe(false);
    expect(hllEstimate(r)).toBe(1);
  });

  it("is close to exact for small counts", () => {
    for (const n of [10, 100, 500]) {
      const r = emptyHll();
      for (let i = 0; i < n; i++) hllAdd(r, h(`v${i}`));
      expect(Math.abs(hllEstimate(r) - n)).toBeLessThanOrEqual(
        Math.max(1, n * 0.03),
      );
    }
  });

  it("stays within ~5% for larger counts", () => {
    const r = emptyHll();
    const n = 20000;
    for (let i = 0; i < n; i++) hllAdd(r, h(`big${i}`));
    expect(Math.abs(hllEstimate(r) - n) / n).toBeLessThan(0.05);
  });

  it("merging days counts people who came on several days once", () => {
    const day1 = emptyHll();
    const day2 = emptyHll();
    for (let i = 0; i < 300; i++) hllAdd(day1, h(`p${i}`));
    for (let i = 200; i < 500; i++) hllAdd(day2, h(`p${i}`)); // 100 overlap
    const range = emptyHll();
    hllMerge(range, day1);
    hllMerge(range, day2);
    expect(Math.abs(hllEstimate(range) - 500)).toBeLessThanOrEqual(10);
  });

  it("positions stay within bounds and round-trip through storage", () => {
    const { index, rank } = hllPosition(new Uint8Array(8));
    expect(index).toBe(0);
    expect(rank).toBe(53);
    const r = emptyHll();
    hllAdd(r, h("x"));
    expect(hllFrom(Buffer.from(r))).toEqual(r);
    expect(hllFrom("garbage")).toEqual(emptyHll());
    expect(hllFrom(new Uint8Array(HLL_REGISTERS - 1))).toEqual(emptyHll());
  });
});
