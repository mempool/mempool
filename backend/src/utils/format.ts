const byteUnits = ['B', 'kB', 'MB', 'GB', 'TB'];

export function getBytesUnit(bytes: number): string {
  if (isNaN(bytes) || !isFinite(bytes)) {
    return 'B';
  }
  
  let unitIndex = 0;
  while (unitIndex < byteUnits.length && bytes > 1024) {
    unitIndex++;
    bytes /= 1024;
  }

  return byteUnits[unitIndex];
}

export function formatBytes(bytes: number, toUnit: string, skipUnit = false): string {
  if (isNaN(bytes) || !isFinite(bytes)) {
    return `${bytes}`;
  }
  
  let unitIndex = 0;
  while (unitIndex < byteUnits.length && (toUnit && byteUnits[unitIndex] !== toUnit || (!toUnit && bytes > 1024))) {
    unitIndex++;
    bytes /= 1024;
  }

  return `${bytes.toFixed(2)}${skipUnit ? '' : ' ' + byteUnits[unitIndex]}`;
}

// https://stackoverflow.com/a/64235212
export function hex2bin(hex: string): string {
  if (!hex) {
    return '';
  }

  hex = hex.replace('0x', '').toLowerCase();
  let out = '';

  for (const c of hex) {
    switch (c) {
      case '0': out += '0000'; break;
      case '1': out += '0001'; break;
      case '2': out += '0010'; break;
      case '3': out += '0011'; break;
      case '4': out += '0100'; break;
      case '5': out += '0101'; break;
      case '6': out += '0110'; break;
      case '7': out += '0111'; break;
      case '8': out += '1000'; break;
      case '9': out += '1001'; break;
      case 'a': out += '1010'; break;
      case 'b': out += '1011'; break;
      case 'c': out += '1100'; break;
      case 'd': out += '1101'; break;
      case 'e': out += '1110'; break;
      case 'f': out += '1111'; break;
      default: return '';
    }
  }
  return out;
}

export function bin2hex(bin: string): string {
  if (!bin) {
    return '';
  }

  let out = '';

  for (let i = 0; i < bin.length; i += 4) {
    const c = bin.substring(i, i + 4);
    switch (c) {
      case '0000': out += '0'; break;
      case '0001': out += '1'; break;
      case '0010': out += '2'; break;
      case '0011': out += '3'; break;
      case '0100': out += '4'; break;
      case '0101': out += '5'; break;
      case '0110': out += '6'; break;
      case '0111': out += '7'; break;
      case '1000': out += '8'; break;
      case '1001': out += '9'; break;
      case '1010': out += 'a'; break;
      case '1011': out += 'b'; break;
      case '1100': out += 'c'; break;
      case '1101': out += 'd'; break;
      case '1110': out += 'e'; break;
      case '1111': out += 'f'; break;
      default: return '';
    }
  }

  return out;
}