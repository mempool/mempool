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

export const download = (href, name) => {
  const a = document.createElement('a');
  a.download = name;
  a.href = href;
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