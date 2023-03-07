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