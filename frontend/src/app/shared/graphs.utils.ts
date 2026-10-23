import { OptimizedMempoolStats } from '@interfaces/node-api.interface';
import { chartColors, feeLevels, subOneChartColors, subOneFeeLevels } from '@app/app.constants';

export const formatterXAxis = (
  locale: string,
  windowPreference: string,
  value: string | number
) => {
  if (typeof value === 'string' && value.length === 0) {
    return null;
  }

  const date = new Date(value);
  switch (windowPreference) {
    case '2h':
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    case '24h':
    case '3d':
    case '1w':
    case '1m':
    case '3m':
    case '6m':
    case '1y':
      return date.toLocaleTimeString(locale, { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' });
    case '2y':
    case '3y':
    case '4y':
    case 'all':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
  }
};

export const formatterXAxisLabel = (
  locale: string,
  windowPreference: string,
) => {
  const date = new Date();
  switch (windowPreference) {
    case '2h':
    case '24h':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case '3d':
    case '1w':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
    case '1m':
    case '3m':
    case '6m':
      return date.toLocaleDateString(locale, { year: 'numeric' });
    case '1y':
    case '2y':
    case '3y':
    case '4y':
      return null;
  }
};

export const formatterXAxisTimeCategory = (
  locale: string,
  windowPreference: string,
  value: number
) => {
  const date = new Date(value);
  switch (windowPreference) {
    case '2h':
      return date.toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
    case '24h':
      return date.toLocaleTimeString(locale, { weekday: 'short', hour: 'numeric' });
    case '3d':
    case '1w':
      return date.toLocaleTimeString(locale, { month: 'short', day: 'numeric', hour: 'numeric' });
    case '1m':
    case '3m':
      return date.toLocaleDateString(locale, { month: 'long', day: 'numeric' });
    case '6m':
    case '1y':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    case '2y':
    case '3y':
    case '4y':
    case 'all':
      return date.toLocaleDateString(locale, { year: 'numeric', month: 'long' });
  }
};

function resolveCssVars(svg: string): string {
  return svg.replace(/var\(--[\w-]+\)/g, (match) => {
    try {
      const varName = match.slice(4, -1);
      return getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim() || match;
    } catch {
      return match;
    }
  });
}

function resolveCssVarsInSvg(dataUrl: string): string {
  try {
    const utf8Prefix = 'data:image/svg+xml;charset=UTF-8,';
    if (dataUrl.startsWith(utf8Prefix)) {
      const svg = decodeURIComponent(dataUrl.slice(utf8Prefix.length));
      return utf8Prefix + encodeURIComponent(resolveCssVars(svg));
    }

    const b64Prefix = 'data:image/svg+xml;base64,';
    if (dataUrl.startsWith(b64Prefix)) {
      const svg = atob(dataUrl.slice(b64Prefix.length));
      return b64Prefix + btoa(resolveCssVars(svg));
    }
  } catch { }
  return dataUrl;
}

export const download = (href: string, name: string, skipCssVarResolve = false): void => {
  const a = document.createElement('a');
  a.download = name;
  a.href = (!skipCssVarResolve && href.startsWith('data:image/svg+xml')) ? resolveCssVarsInSvg(href) : href;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export function detectWebGL(): boolean {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl');
  return !!(gl && gl instanceof WebGLRenderingContext);
}

/**
 * https://gist.githubusercontent.com/rosszurowski/67f04465c424a9bc0dae/raw/90ee06c5aa84ab352eb5b233d0a8263c3d8708e5/lerp-color.js
 * A linear interpolator for hexadecimal colors
 * @param {String} a
 * @param {String} b
 * @param {Number} amount
 * @example
 * // returns #7F7F7F
 * lerpColor('#000000', '#ffffff', 0.5)
 * @returns {String}
 */
export function lerpColor(a: string, b: string, amount: number): string {
  const ah = parseInt(a.replace(/#/g, ''), 16),
    ar = ah >> 16, ag = ah >> 8 & 0xff, ab = ah & 0xff,
    bh = parseInt(b.replace(/#/g, ''), 16),
    br = bh >> 16, bg = bh >> 8 & 0xff, bb = bh & 0xff,
    rr = ar + amount * (br - ar),
    rg = ag + amount * (bg - ag),
    rb = ab + amount * (bb - ab);

  return '#' + ((1 << 24) + (rr << 16) + (rg << 8) + rb | 0).toString(16).slice(1);
}

export interface StatsFeeBands {
  levels: number[]; // lower bound of each band, ascending
  lower: string[];
  upper: (string | null)[];
  colors: string[];
  hasSubOne: boolean;
}

/**
 * Fee bands for the mempool statistics charts.
 * When the stats carry the 0.1 sat/vB breakdown of the 0-1 band, that band is replaced by:
 * - a "0 - 1" band holding whatever has no breakdown (rows recorded before it existed)
 * - ten 0.1 sat/vB bands
 */
export function getStatsFeeBands(stats: OptimizedMempoolStats[], isLiquid: boolean): StatsFeeBands {
  const hasSubOne = !isLiquid && stats.some(s => s.vsizes_sub1?.some(v => v > 0));
  const format = (fee: number): string => isLiquid ? (fee / 10).toFixed(1) : `${fee}`;
  const levels = hasSubOne ? [0, ...subOneFeeLevels, ...feeLevels.slice(1)] : feeLevels;
  const lower = levels.map(format);
  const upper = levels.map((_, i) => i + 1 < levels.length ? format(levels[i + 1]) : null);
  if (hasSubOne) {
    upper[0] = format(1);
  }
  const colors = hasSubOne ? [chartColors[0], ...subOneChartColors, ...chartColors.slice(1)] : chartColors;
  return { levels, lower, upper, colors, hasSubOne };
}

export function getStatsBandVsizes(stats: OptimizedMempoolStats, bands: StatsFeeBands): number[] {
  if (!bands.hasSubOne) {
    return stats.vsizes;
  }
  const subOne = subOneFeeLevels.map((_, i) => stats.vsizes_sub1?.[i] || 0);
  const unsplit = Math.max(0, (stats.vsizes[0] || 0) - subOne.reduce((acc, v) => acc + v, 0));
  return [unsplit, ...subOne, ...stats.vsizes.slice(1)];
}

export function getStatsBandLabel(bands: StatsFeeBands, index: number, isTop = false): string {
  return (isTop || bands.upper[index] == null) ? `${bands.lower[index]}+` : `${bands.lower[index]} - ${bands.upper[index]}`;
}
