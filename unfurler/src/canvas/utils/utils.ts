import { CanvasRenderingContext2D, createCanvas } from 'canvas';
import * as QRCode from 'qrcode';
import { Rect } from '../components';

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

export function middleEllipsis(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, endChars: number = 4): string {
  const ellipsis = '…';

  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let tailLen = Math.min(endChars, text.length);
  while (tailLen > 0 && ctx.measureText(ellipsis + text.slice(-tailLen)).width > maxWidth) {
    tailLen--;
  }

  if (tailLen === 0) {
    return ctx.measureText(ellipsis).width <= maxWidth ? ellipsis : '';
  }

  const tail = text.slice(-tailLen);

  // Binary search the max prefix length that fits with ellipsis + tail.
  let lo = 0;
  let hi = Math.max(0, text.length - tailLen);
  let best = '';

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const left = text.slice(0, mid);
    const candidate = left + ellipsis + tail;
    const w = ctx.measureText(candidate).width;

    if (w <= maxWidth) {
      best = candidate;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return best || (ctx.measureText(ellipsis + tail).width <= maxWidth ? ellipsis + tail : ellipsis);
}

export function renderQrToCtx(ctx: CanvasRenderingContext2D, text: string, bound: Rect, opts: QRCode.QRCodeRenderersOptions = {}): void {
  const size = Math.min(bound.w, bound.h);
  const off = createCanvas(size, size);

  QRCode.toCanvas(
    off as any,
    text,
    {
      errorCorrectionLevel: 'M',
      margin: 1,
      color: { dark: '#000', light: '#fff' },
      width: size,
      ...opts,
    },
    (err) => {
      if (err) {
        throw err;
      }
      ctx.drawImage(off as any, bound.x, bound.y, size, size);
    }
  );
}
