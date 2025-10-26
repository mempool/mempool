import crypto from 'crypto';

export function scriptPubKeyToAddress(scriptPubKey: string, network: string = ''): { address?: string, type: string } {
  // P2PKH
  if (/^76a914[0-9a-f]{40}88ac$/.test(scriptPubKey)) {
    return { address: p2pkh(scriptPubKey.substring(6, 6 + 40), network), type: 'p2pkh' };
  }
  // P2PK
  if (/^21[0-9a-f]{66}ac$/.test(scriptPubKey) || /^41[0-9a-f]{130}ac$/.test(scriptPubKey)) {
    return { type: 'p2pk' };
  }
  // P2SH
  if (/^a914[0-9a-f]{40}87$/.test(scriptPubKey)) {
    return { address: p2sh(scriptPubKey.substring(4, 4 + 40), network), type: 'p2sh' };
  }
  // P2WPKH
  if (/^0014[0-9a-f]{40}$/.test(scriptPubKey)) {
    return { address: p2wpkh(scriptPubKey.substring(4, 4 + 40), network), type: 'v0_p2wpkh' };
  }
  // P2WSH
  if (/^0020[0-9a-f]{64}$/.test(scriptPubKey)) {
    return { address: p2wsh(scriptPubKey.substring(4, 4 + 64), network), type: 'v0_p2wsh' };
  }
  // P2TR
  if (/^5120[0-9a-f]{64}$/.test(scriptPubKey)) {
    return { address: p2tr(scriptPubKey.substring(4, 4 + 64), network), type: 'v1_p2tr' };
  }
  // multisig
  if (/^[0-9a-f]+ae$/.test(scriptPubKey)) {
    return { type: 'multisig' };
  }
  // anchor
  if (scriptPubKey === '51024e73') {
    return { address: p2a(network), type: 'anchor' };
  }
  // op_return
  if (/^6a/.test(scriptPubKey)) {
    return { type: 'op_return' };
  }
  return { type: 'unknown' };
}

function sha256(data: Uint8Array): Uint8Array {
  return crypto.createHash('sha256').update(data).digest();
}

function p2pkh(pubKeyHash: string, network: string): string {
  const pubkeyHashArray = hexStringToUint8Array(pubKeyHash);
  const version = ['testnet', 'testnet4', 'signet'].includes(network) ? 0x6f : 0x00;
  const versionedPayload = Uint8Array.from([version, ...pubkeyHashArray]);
  const hash1 = sha256(versionedPayload);
  const hash2 = sha256(hash1);
  const checksum = hash2.slice(0, 4);
  const finalPayload = Uint8Array.from([...versionedPayload, ...checksum]);
  const bitcoinAddress = base58Encode(finalPayload);
  return bitcoinAddress;
}

function p2sh(scriptHash: string, network: string): string {
  const scriptHashArray = hexStringToUint8Array(scriptHash);
  const version = ['testnet', 'testnet4', 'signet'].includes(network) ? 0xc4 : 0x05;
  const versionedPayload = Uint8Array.from([version, ...scriptHashArray]);
  const hash1 = sha256(versionedPayload);
  const hash2 = sha256(hash1);
  const checksum = hash2.slice(0, 4);
  const finalPayload = Uint8Array.from([...versionedPayload, ...checksum]);
  const bitcoinAddress = base58Encode(finalPayload);
  return bitcoinAddress;
}

function p2wpkh(pubKeyHash: string, network: string): string {
  const pubkeyHashArray = hexStringToUint8Array(pubKeyHash);
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 0;
  const words = [version].concat(toWords(pubkeyHashArray));
  const bech32Address = bech32Encode(hrp, words);
  return bech32Address;
}

function p2wsh(scriptHash: string, network: string): string {
  const scriptHashArray = hexStringToUint8Array(scriptHash);
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 0;
  const words = [version].concat(toWords(scriptHashArray));
  const bech32Address = bech32Encode(hrp, words);
  return bech32Address;
}

function p2tr(pubKeyHash: string, network: string): string {
  const pubkeyHashArray = hexStringToUint8Array(pubKeyHash);
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 1;
  const words = [version].concat(toWords(pubkeyHashArray));
  const bech32Address = bech32Encode(hrp, words, 0x2bc830a3);
  return bech32Address;
}

function p2a(network: string): string {
  const pubkeyHashArray = hexStringToUint8Array('4e73');
  const hrp = ['testnet', 'testnet4', 'signet'].includes(network) ? 'tb' : 'bc';
  const version = 1;
  const words = [version].concat(toWords(pubkeyHashArray));
  const bech32Address = bech32Encode(hrp, words, 0x2bc830a3);
  return bech32Address;
}

// base58 encoding
function base58Encode(data: Uint8Array): string {
  const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

  const hexString = Array.from(data)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');

  let num = BigInt('0x' + hexString);

  let encoded = '';
  while (num > 0) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  for (const byte of data) {
    if (byte === 0) {
      encoded = '1' + encoded;
    } else {
      break;
    }
  }

  return encoded;
}

// bech32 encoding
// Adapted from https://github.com/bitcoinjs/bech32/blob/5ceb0e3d4625561a459c85643ca6947739b2d83c/src/index.ts
function bech32Encode(prefix: string, words: number[], constant: number = 1): string {
  const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

  const checksum = createChecksum(prefix, words, constant);
  const combined = words.concat(checksum);
  let result = prefix + '1';
  for (let i = 0; i < combined.length; ++i) {
    result += BECH32_ALPHABET.charAt(combined[i]);
  }
  return result;
}

function polymodStep(pre: number): number {
  const GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  const b = pre >> 25;
  return (
    ((pre & 0x1ffffff) << 5) ^
    ((b & 1 ? GENERATORS[0] : 0) ^
      (b & 2 ? GENERATORS[1] : 0) ^
      (b & 4 ? GENERATORS[2] : 0) ^
      (b & 8 ? GENERATORS[3] : 0) ^
      (b & 16 ? GENERATORS[4] : 0))
  );
}

function prefixChk(prefix: string): number {
  let chk = 1;
  for (let i = 0; i < prefix.length; ++i) {
    const c = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (c >> 5);
  }
  chk = polymodStep(chk);
  for (let i = 0; i < prefix.length; ++i) {
    const c = prefix.charCodeAt(i);
    chk = polymodStep(chk) ^ (c & 0x1f);
  }
  return chk;
}

function createChecksum(prefix: string, words: number[], constant: number): number[] {
  const POLYMOD_CONST = constant;
  let chk = prefixChk(prefix);
  for (let i = 0; i < words.length; ++i) {
    const x = words[i];
    chk = polymodStep(chk) ^ x;
  }
  for (let i = 0; i < 6; ++i) {
    chk = polymodStep(chk);
  }
  chk ^= POLYMOD_CONST;

  const checksum: number[] = [];
  for (let i = 0; i < 6; ++i) {
    checksum.push((chk >> (5 * (5 - i))) & 31);
  }
  return checksum;
}

function convertBits(data: Uint8Array, fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const ret: number[] = [];
  const maxV = (1 << toBits) - 1;

  for (let i = 0; i < data.length; ++i) {
    const value = data[i];
    if (value < 0 || value >> fromBits) {
      throw new Error('Invalid value');
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxV);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxV);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxV)) {
    throw new Error('Invalid data');
  }
  return ret;
}

function toWords(bytes: Uint8Array): number[] {
  return convertBits(bytes, 8, 5, true);
}

export function hexStringToUint8Array(hex: string): Uint8Array {
  const buf = new Uint8Array(hex.length / 2);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return buf;
}