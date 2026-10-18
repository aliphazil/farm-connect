/**
 * HyperLogLog: estimates how many distinct visitors there were over several
 * days without storing anything that identifies them. Each visitor's hash
 * only raises one of 4096 small registers; a day's registers can be merged
 * with other days' (taking the maximum) to count distinct visitors across a
 * whole range. Standard error is about 1.6%, and small counts (up to a few
 * thousand) use linear counting, which is close to exact.
 */

export const HLL_BITS = 12;
export const HLL_REGISTERS = 1 << HLL_BITS;

export type HllRegisters = Uint8Array;

export function emptyHll(): HllRegisters {
  return new Uint8Array(HLL_REGISTERS);
}

/**
 * Register index and rank for a hash (at least 8 bytes, e.g. SHA-256).
 * The first 12 bits pick the register; the rank is the position of the
 * first 1-bit in the next 52 bits.
 */
export function hllPosition(hash: Uint8Array): { index: number; rank: number } {
  if (hash.length < 8) throw new Error("hash too short");
  const view = new DataView(hash.buffer, hash.byteOffset, 8);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const index = hi >>> (32 - HLL_BITS);
  // Remaining 20 bits of `hi`, then the 32 bits of `lo`.
  const restHi = (hi << HLL_BITS) >>> HLL_BITS;
  let rank = 1;
  for (let bit = 32 - HLL_BITS - 1; bit >= 0; bit--, rank++)
    if ((restHi >>> bit) & 1) return { index, rank };
  for (let bit = 31; bit >= 0; bit--, rank++)
    if ((lo >>> bit) & 1) return { index, rank };
  return { index, rank };
}

/** Adds a hash; returns true if a register changed. */
export function hllAdd(registers: HllRegisters, hash: Uint8Array): boolean {
  const { index, rank } = hllPosition(hash);
  if (registers[index] >= rank) return false;
  registers[index] = rank;
  return true;
}

/** Merges `other` into `into` (register-wise maximum). */
export function hllMerge(into: HllRegisters, other: HllRegisters) {
  for (let i = 0; i < HLL_REGISTERS; i++)
    if (other[i] > into[i]) into[i] = other[i];
}

export function hllEstimate(registers: HllRegisters): number {
  const m = HLL_REGISTERS;
  let sum = 0;
  let zeros = 0;
  for (let i = 0; i < m; i++) {
    sum += 2 ** -registers[i];
    if (registers[i] === 0) zeros++;
  }
  const alpha = 0.7213 / (1 + 1.079 / m);
  const raw = (alpha * m * m) / sum;
  // Small ranges: linear counting is far more accurate.
  if (raw <= 2.5 * m && zeros > 0) return Math.round(m * Math.log(m / zeros));
  return Math.round(raw);
}

/** Registers from stored bytes (a Firestore Bytes/Buffer or base64 string). */
export function hllFrom(value: unknown): HllRegisters {
  const out = emptyHll();
  if (value instanceof Uint8Array && value.length === HLL_REGISTERS)
    out.set(value);
  else if (
    value &&
    typeof (value as { toUint8Array?: unknown }).toUint8Array === "function"
  ) {
    const bytes = (value as { toUint8Array: () => Uint8Array }).toUint8Array();
    if (bytes.length === HLL_REGISTERS) out.set(bytes);
  }
  return out;
}
