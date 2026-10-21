export const digestLength: number = 20;

// message word selection, left and right lines
const R = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
  3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
  1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
  4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13,
];
const RR = [
  5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
  6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
  15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
  8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
  12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11,
];
// rotate-left amounts, left and right lines
const S = [
  11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
  7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
  11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
  11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
  9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6,
];
const SR = [
  8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
  9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
  9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
  15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
  8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11,
];
const K = [0x00000000, 0x5a827999, 0x6ed9eba1, 0x8f1bbcdc, 0xa953fd4e];
const KR = [0x50a28be6, 0x5c4dd124, 0x6d703ef3, 0x7a6d76e9, 0x00000000];

function f(j: number, x: number, y: number, z: number): number {
  if (j < 16) { return x ^ y ^ z; }
  if (j < 32) { return (x & y) | (~x & z); }
  if (j < 48) { return (x | ~y) ^ z; }
  if (j < 64) { return (x & z) | (y & ~z); }
  return x ^ (y | ~z);
}

function rotl(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n));
}

// Returns RIPEMD-160 hash of data.
export function ripemd160(data: Uint8Array): Uint8Array {
  // pad: 0x80, zeros to 56 mod 64, then the bit length as 64-bit little-endian
  const padded = new Uint8Array(((data.length + 8) >> 6) * 64 + 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, (data.length * 8) >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(data.length / 0x20000000), true);

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const x = new Array<number>(16);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      x[i] = view.getUint32(offset + i * 4, true);
    }
    let al = h[0], bl = h[1], cl = h[2], dl = h[3], el = h[4];
    let ar = h[0], br = h[1], cr = h[2], dr = h[3], er = h[4];
    for (let j = 0; j < 80; j++) {
      let t = (rotl((al + f(j, bl, cl, dl) + x[R[j]] + K[j >> 4]) | 0, S[j]) + el) | 0;
      al = el; el = dl; dl = rotl(cl, 10); cl = bl; bl = t;
      t = (rotl((ar + f(79 - j, br, cr, dr) + x[RR[j]] + KR[j >> 4]) | 0, SR[j]) + er) | 0;
      ar = er; er = dr; dr = rotl(cr, 10); cr = br; br = t;
    }
    const t = (h[1] + cl + dr) | 0;
    h[1] = (h[2] + dl + er) | 0;
    h[2] = (h[3] + el + ar) | 0;
    h[3] = (h[4] + al + br) | 0;
    h[4] = (h[0] + bl + cr) | 0;
    h[0] = t;
  }

  const out = new Uint8Array(digestLength);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 5; i++) {
    outView.setUint32(i * 4, h[i] >>> 0, true);
  }
  return out;
}

export default ripemd160;
