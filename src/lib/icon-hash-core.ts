// Perceptual "difference hash" (dHash) - shared math used by both the
// one-time Node precompute script (scripts/build-icon-hashes.ts, reads
// reference icons via sharp) and the client-side matcher (icon-match.ts,
// reads screenshot crops via <canvas>). Both sides MUST resize to the same
// 9x8 and feed this the same RGB layout for hashes to be comparable at all -
// that's why the actual bit-math lives in exactly one place.
//
// Algorithm: shrink to 9x8, convert to luminance, then for each of the 8
// rows compare each pixel to its right neighbor (8 comparisons/row x 8 rows
// = 64 bits). Robust to the icon being scaled/resampled differently between
// the reference image and a screenshot crop, which is exactly the situation
// here - it does NOT need pixel-exact resolution to match, only "roughly
// the same shape of light/dark gradient", which a portrait/item icon has
// plenty of.

export const HASH_WIDTH = 9;
export const HASH_HEIGHT = 8;

/** pixels: RGB triplets (no alpha), length must be HASH_WIDTH*HASH_HEIGHT*3, row-major. */
export function dHashFromRgb(pixels: Uint8Array | Uint8ClampedArray): string {
  const lum = new Float32Array(HASH_WIDTH * HASH_HEIGHT);
  for (let i = 0; i < lum.length; i++) {
    const o = i * 3;
    lum[i] = 0.299 * pixels[o] + 0.587 * pixels[o + 1] + 0.114 * pixels[o + 2];
  }

  let bits = '';
  let nibble = 0;
  let nibbleBits = 0;
  const pushBit = (b: number) => {
    nibble = (nibble << 1) | b;
    nibbleBits++;
    if (nibbleBits === 4) {
      bits += nibble.toString(16);
      nibble = 0;
      nibbleBits = 0;
    }
  };

  for (let y = 0; y < HASH_HEIGHT; y++) {
    for (let x = 0; x < HASH_WIDTH - 1; x++) {
      const left = lum[y * HASH_WIDTH + x];
      const right = lum[y * HASH_WIDTH + x + 1];
      pushBit(left < right ? 1 : 0);
    }
  }
  return bits; // 64 bits -> 16 hex chars
}

/** Hamming distance between two same-length hex hash strings (lower = more similar, 0 = identical). */
export function hammingDistance(a: string, b: string): number {
  let dist = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}
