import { feeLevels, mempoolFeeColors } from '../../app.constants';
import { Color } from './sprite-types';
import TxView from './tx-view';

export function hexToColor(hex: string): Color {
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: hex.length > 6 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
  };
}

export function desaturate(color: Color, amount: number): Color {
  const gray = (color.r + color.g + color.b) / 6;
  return {
    r: color.r + ((gray - color.r) * amount),
    g: color.g + ((gray - color.g) * amount),
    b: color.b + ((gray - color.b) * amount),
    a: color.a,
  };
}

export function darken(color: Color, amount: number): Color {
  return {
    r: color.r * amount,
    g: color.g * amount,
    b: color.b * amount,
    a: color.a,
  };
}

export function setOpacity(color: Color, opacity: number): Color {
  return {
    ...color,
    a: opacity
  };
}

// precomputed colors
export const defaultFeeColors = mempoolFeeColors.map(hexToColor);
export const defaultAuditFeeColors = defaultFeeColors.map((color) => darken(desaturate(color, 0.3), 0.9));
export const defaultMarginalFeeColors = defaultFeeColors.map((color) => darken(desaturate(color, 0.8), 1.1));
export const defaultAuditColors = {
  censored: hexToColor('f344df'),
  missing: darken(desaturate(hexToColor('f344df'), 0.3), 0.7),
  added: hexToColor('0099ff'),
  selected: darken(desaturate(hexToColor('0099ff'), 0.3), 0.7),
  accelerated: hexToColor('8F5FF6'),
};

export function defaultColorFunction(
  tx: TxView,
  feeColors: Color[] = defaultFeeColors,
  auditFeeColors: Color[] = defaultAuditFeeColors,
  marginalFeeColors: Color[] = defaultMarginalFeeColors,
  auditColors: { [status: string]: Color } = defaultAuditColors
): Color {
  const rate = tx.fee / tx.vsize; // color by simple single-tx fee rate
  const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, rate) < feeLvl) - 1;
  const feeLevelColor = feeColors[feeLevelIndex] || feeColors[mempoolFeeColors.length - 1];
  // Normal mode
  if (!tx.scene?.highlightingEnabled) {
    if (tx.acc) {
      return auditColors.accelerated;
    } else {
      return feeLevelColor;
    }
    return feeLevelColor;
  }
  // Block audit
  switch(tx.status) {
    case 'censored':
      return auditColors.censored;
    case 'missing':
    case 'sigop':
    case 'rbf':
      return marginalFeeColors[feeLevelIndex] || marginalFeeColors[mempoolFeeColors.length - 1];
    case 'fresh':
    case 'freshcpfp':
      return auditColors.missing;
    case 'added':
      return auditColors.added;
    case 'selected':
      return marginalFeeColors[feeLevelIndex] || marginalFeeColors[mempoolFeeColors.length - 1];
    case 'accelerated':
      return auditColors.accelerated;
    case 'found':
      if (tx.context === 'projected') {
        return auditFeeColors[feeLevelIndex] || auditFeeColors[mempoolFeeColors.length - 1];
      } else {
        return feeLevelColor;
      }
    default:
      if (tx.acc) {
        return auditColors.accelerated;
      } else {
        return feeLevelColor;
      }
  }
}