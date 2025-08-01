export function formatWeightUnit(WU: number, decimal: number): { num: string, unit: string } {
  const units = ['WU', 'kWU', 'MWU', 'GWU', 'TWU'];
  const base = 1000;
  let value = WU;
  let unitIndex = 0;

  while (unitIndex < units.length - 1 && value >= base) {
    value /= base;
    unitIndex++;
  }

  const roundedValue = Math.round(value * Math.pow(10, decimal)) / Math.pow(10, decimal);

  const formattedValue = decimal > 0
    ? roundedValue.toFixed(decimal).replace(/\.?0+$/, '')
    : roundedValue.toString();

  return { num: formattedValue, unit: units[unitIndex] }
}

export function formatNumber(num: number, rounding: string = '') {
  const options: Intl.NumberFormatOptions = {
  };

  if (rounding) { // Parse rounding format like '1.2-4' (min 2, max 4 decimal places)
    const parts = rounding.split('.');
    if (parts.length === 2) {
      const [, decimals] = parts;
      const [min, max] = decimals.split('-').map(Number);

      options.minimumFractionDigits = min || 0;
      options.maximumFractionDigits = max !== undefined ? max : min || 0;
    }
  }

  return new Intl.NumberFormat('en-US', options).format(num);
}
