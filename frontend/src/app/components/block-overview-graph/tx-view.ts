import TxSprite from './tx-sprite';
import { FastVertexArray } from './fast-vertex-array';
import { TransactionStripped } from '../../interfaces/websocket.interface';
import { SpriteUpdateParams, Square, Color, ViewUpdateParams } from './sprite-types';
import { feeLevels, mempoolFeeColors } from '../../app.constants';
import BlockScene from './block-scene';

const hoverTransitionTime = 300;
const defaultHoverColor = hexToColor('1bd8f4');

const feeColors = mempoolFeeColors.map(hexToColor);
const auditFeeColors = feeColors.map((color) => darken(desaturate(color, 0.3), 0.9));
const marginalFeeColors = feeColors.map((color) => darken(desaturate(color, 0.8), 1.1));
const auditColors = {
  censored: hexToColor('f344df'),
  missing: darken(desaturate(hexToColor('f344df'), 0.3), 0.7),
  added: hexToColor('0099ff'),
  selected: darken(desaturate(hexToColor('0099ff'), 0.3), 0.7),
};

// convert from this class's update format to TxSprite's update format
function toSpriteUpdate(params: ViewUpdateParams): SpriteUpdateParams {
  return {
    start: (params.start || performance.now()) + (params.delay || 0),
    duration: params.duration,
    minDuration: params.minDuration,
    ...params.display.position,
    ...params.display.color,
    adjust: params.adjust
  };
}

export default class TxView implements TransactionStripped {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
  feerate: number;
  rate?: number;
  status?: 'found' | 'missing' | 'sigop' | 'fresh' | 'added' | 'censored' | 'selected';
  context?: 'projected' | 'actual';
  scene?: BlockScene;

  initialised: boolean;
  vertexArray: FastVertexArray;
  hover: boolean;
  sprite: TxSprite;
  hoverColor: Color | void;

  screenPosition: Square;
  gridPosition: Square | void;

  dirty: boolean;

  constructor(tx: TransactionStripped, scene: BlockScene) {
    this.scene = scene;
    this.context = tx.context;
    this.txid = tx.txid;
    this.fee = tx.fee;
    this.vsize = tx.vsize;
    this.value = tx.value;
    this.feerate = tx.rate || (tx.fee / tx.vsize); // sort by effective fee rate where available
    this.rate = tx.rate;
    this.status = tx.status;
    this.initialised = false;
    this.vertexArray = scene.vertexArray;

    this.hover = false;

    this.screenPosition = { x: 0, y: 0, s: 0 };

    this.dirty = true;
  }

  destroy(): void {
    if (this.sprite) {
      this.sprite.destroy();
      this.sprite = null;
      this.initialised = false;
    }
  }

  applyGridPosition(position: Square): void {
    if (!this.gridPosition) {
      this.gridPosition = { x: 0, y: 0, s: 0 };
    }
    if (this.gridPosition.x !== position.x || this.gridPosition.y !== position.y || this.gridPosition.s !== position.s) {
      this.gridPosition.x = position.x;
      this.gridPosition.y = position.y;
      this.gridPosition.s = position.s;
      this.dirty = true;
    }
  }

  /*
    display: defines the final appearance of the sprite
        position: { x, y, s } (coordinates & size)
        color: { r, g, b, a} (color channels & alpha)
    duration: of the tweening animation from the previous display state
    start: performance.now() timestamp, when to start the transition
    delay: additional milliseconds to wait before starting
    jitter: if set, adds a random amount to the delay,
    adjust: if true, modify an in-progress transition instead of replacing it

    returns minimum transition end time
  */
  update(params: ViewUpdateParams): number {
    if (params.jitter) {
      params.delay += (Math.random() * params.jitter);
    }

    if (!this.initialised || !this.sprite) {
      this.initialised = true;
      this.sprite = new TxSprite(
        toSpriteUpdate(params),
        this.vertexArray
      );
      // apply any pending hover event
      if (this.hover) {
        params.duration = Math.max(params.duration, hoverTransitionTime);
        this.sprite.update({
          ...this.hoverColor,
          duration: hoverTransitionTime,
          adjust: false,
          temp: true
        });
      }
    } else {
      this.sprite.update(
        toSpriteUpdate(params)
      );
    }
    this.dirty = false;
    return (params.start || performance.now()) + (params.delay || 0) + (params.duration || 0);
  }

  // Temporarily override the tx color
  // returns minimum transition end time
  setHover(hoverOn: boolean, color: Color | void = defaultHoverColor): number {
    if (hoverOn) {
      this.hover = true;
      this.hoverColor = color;

      this.sprite.update({
        ...this.hoverColor,
        duration: hoverTransitionTime,
        adjust: false,
        temp: true
      });
    } else {
      this.hover = false;
      this.hoverColor = null;
      if (this.sprite) {
        this.sprite.resume(hoverTransitionTime);
      }
    }
    this.dirty = false;
    return performance.now() + hoverTransitionTime;
  }

  getColor(): Color {
    const rate = this.fee / this.vsize; // color by simple single-tx fee rate
    const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, rate) < feeLvl) - 1;
    const feeLevelColor = feeColors[feeLevelIndex] || feeColors[mempoolFeeColors.length - 1];
    // Normal mode
    if (!this.scene?.highlightingEnabled) {
      return feeLevelColor;
    }
    // Block audit
    switch(this.status) {
      case 'censored':
        return auditColors.censored;
      case 'missing':
      case 'sigop':
        return marginalFeeColors[feeLevelIndex] || marginalFeeColors[mempoolFeeColors.length - 1];
      case 'fresh':
        return auditColors.missing;
      case 'added':
        return auditColors.added;
      case 'selected':
        return marginalFeeColors[feeLevelIndex] || marginalFeeColors[mempoolFeeColors.length - 1];
      case 'found':
        if (this.context === 'projected') {
          return auditFeeColors[feeLevelIndex] || auditFeeColors[mempoolFeeColors.length - 1];
        } else {
          return feeLevelColor;
        }
      default:
        return feeLevelColor;
    }
  }
}

function hexToColor(hex: string): Color {
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: 1
  };
}

function desaturate(color: Color, amount: number): Color {
  const gray = (color.r + color.g + color.b) / 6;
  return {
    r: color.r + ((gray - color.r) * amount),
    g: color.g + ((gray - color.g) * amount),
    b: color.b + ((gray - color.b) * amount),
    a: color.a,
  };
}

function darken(color: Color, amount: number): Color {
  return {
    r: color.r * amount,
    g: color.g * amount,
    b: color.b * amount,
    a: color.a,
  }
}
