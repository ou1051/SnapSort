/**
 * Difference hash ("dHash") for spotting near-identical screenshots.
 *
 * The image is shrunk to 9×8 pixels and turned to greyscale. Each bit says
 * whether a pixel is brighter than its right-hand neighbour, giving 64 bits.
 * Two screenshots of the same screen differ by only a few bits, while two
 * screenshots taken while scrolling through an article differ by many.
 */

export const HASH_W = 9;
export const HASH_H = 8;

/** rgba: 9*8*4 bytes, row-major. Returns 16 hex chars. */
export function dhashFromRgba(rgba: Uint8Array, width = HASH_W, height = HASH_H): string {
  if (width !== HASH_W || height !== HASH_H) {
    throw new Error(`dhash expects ${HASH_W}x${HASH_H} pixels, got ${width}x${height}`);
  }
  if (rgba.length < width * height * 4) throw new Error('dhash: pixel buffer too small');

  const grey = new Array<number>(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  let hex = '';
  let nibble = 0;
  let bitsInNibble = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width - 1; x++) {
      const left = grey[y * width + x];
      const right = grey[y * width + x + 1];
      nibble = (nibble << 1) | (left > right ? 1 : 0);
      bitsInNibble++;
      if (bitsInNibble === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bitsInNibble = 0;
      }
    }
  }
  return hex;
}

const POPCOUNT4 = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

/** Number of differing bits between two 16-hex-char hashes (0–64). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    const x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    if (Number.isNaN(x)) return 64;
    d += POPCOUNT4[x];
  }
  return d;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  t['-'.charCodeAt(0)] = 62; // url-safe variants
  t['_'.charCodeAt(0)] = 63;
  return t;
})();

/** Dependency-free base64 decoder (Hermes' atob is not relied upon). */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/^data:[^,]*,/, '').replace(/[\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let o = 0;
  for (let i = 0; i < clean.length; i++) {
    const v = B64_LOOKUP[clean.charCodeAt(i)];
    if (v < 0) throw new Error('base64: invalid character');
    buffer = (buffer << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}
