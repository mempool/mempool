function powMod(x: bigint, power: number, modulo: bigint): bigint {
  for (let i = 0; i < power; i++) {
    x = (x * x) % modulo;
  }
  return x;
}

function sqrtMod(x: bigint, P: bigint): bigint {
  const b2 = (x * x * x) % P;
  const b3 = (b2 * b2 * x) % P;
  const b6 = (powMod(b3, 3, P) * b3) % P;
  const b9 = (powMod(b6, 3, P) * b3) % P;
  const b11 = (powMod(b9, 2, P) * b2) % P;
  const b22 = (powMod(b11, 11, P) * b11) % P;
  const b44 = (powMod(b22, 22, P) * b22) % P;
  const b88 = (powMod(b44, 44, P) * b44) % P;
  const b176 = (powMod(b88, 88, P) * b88) % P;
  const b220 = (powMod(b176, 44, P) * b44) % P;
  const b223 = (powMod(b220, 3, P) * b3) % P;
  const t1 = (powMod(b223, 23, P) * b22) % P;
  const t2 = (powMod(t1, 6, P) * b2) % P;
  const root = powMod(t2, 2, P);
  return root;
}

const curveP = BigInt(`0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F`);

/**
 * This function tells whether the point given is a DER encoded point on the ECDSA curve.
 * @param {string} pointHex The point as a hex string (*must not* include a '0x' prefix)
 * @returns {boolean} true if the point is on the SECP256K1 curve
 */
export function isPoint(pointHex: string): boolean {
  if (!pointHex?.length) {
    return false;
  }
  if (
    !(
      // is uncompressed
      (
        (pointHex.length === 130 && pointHex.startsWith('04')) ||
        // OR is compressed
        (pointHex.length === 66 &&
          (pointHex.startsWith('02') || pointHex.startsWith('03')))
      )
    )
  ) {
    return false;
  }

  // Function modified slightly from noble-curves
  

  // Now we know that pointHex is a 33 or 65 byte hex string.
  const isCompressed = pointHex.length === 66;

  const x = BigInt(`0x${pointHex.slice(2, 66)}`);
  if (x >= curveP) {
    return false;
  }

  if (!isCompressed) {
    const y = BigInt(`0x${pointHex.slice(66, 130)}`);
    if (y >= curveP) {
      return false;
    }
    // Just check y^2 = x^3 + 7 (secp256k1 curve)
    return (y * y) % curveP === (x * x * x + 7n) % curveP;
  } else {
    // Get unaltered y^2 (no mod p)
    const ySquared = (x * x * x + 7n) % curveP;
    // Try to sqrt it, it will round down if not perfect root
    const y = sqrtMod(ySquared, curveP);
    // If we square and it's equal, then it was a perfect root and valid point.
    return (y * y) % curveP === ySquared;
  }
}