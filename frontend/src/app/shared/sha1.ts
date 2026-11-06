export const digestLength: number = 20;

function rotl(x: number, n: number): number {
  return (x << n) | (x >>> (32 - n));
}

// Returns SHA-1 hash of data (FIPS 180-4). Only for OP_SHA1: SHA-1 is broken for collisions, never use it for security.
export function sha1(data: Uint8Array): Uint8Array {
  // pad: 0x80, zeros to 56 mod 64, then the bit length as 64-bit big-endian
  const padded = new Uint8Array(((data.length + 8) >> 6) * 64 + 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(data.length / 0x20000000), false);
  view.setUint32(padded.length - 4, (data.length * 8) >>> 0, false);

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 80; i++) {
      w[i] = rotl(w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16], 1);
    }
    let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4];
    for (let j = 0; j < 80; j++) {
      let f: number, k: number;
      if (j < 20) {
        f = (b & c) | (~b & d); k = 0x5a827999;
      } else if (j < 40) {
        f = b ^ c ^ d; k = 0x6ed9eba1;
      } else if (j < 60) {
        f = (b & c) | (b & d) | (c & d); k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d; k = 0xca62c1d6;
      }
      const t = (rotl(a, 5) + f + e + k + w[j]) | 0;
      e = d; d = c; c = rotl(b, 30); b = a; a = t;
    }
    h[0] = (h[0] + a) | 0;
    h[1] = (h[1] + b) | 0;
    h[2] = (h[2] + c) | 0;
    h[3] = (h[3] + d) | 0;
    h[4] = (h[4] + e) | 0;
  }

  const out = new Uint8Array(digestLength);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 5; i++) {
    outView.setUint32(i * 4, h[i] >>> 0, false);
  }
  return out;
}

export default sha1;
