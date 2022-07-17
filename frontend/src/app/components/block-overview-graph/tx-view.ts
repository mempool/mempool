import TxSprite from './tx-sprite';
import { FastVertexArray } from './fast-vertex-array';
import { TransactionStripped } from 'src/app/interfaces/websocket.interface';
import { SpriteUpdateParams, Square, Color, ViewUpdateParams } from './sprite-types';
import { feeLevels, mempoolFeeColors } from 'src/app/app.constants';

const hoverTransitionTime = 300;
const defaultHoverColor = hexToColor('1bd8f4');

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
  status?: 'found' | 'missing' | 'added';

  initialised: boolean;
  vertexArray: FastVertexArray;
  hover: boolean;
  sprite: TxSprite;
  hoverColor: Color | void;

  screenPosition: Square;
  gridPosition: Square | void;

  dirty: boolean;

  constructor(tx: TransactionStripped, vertexArray: FastVertexArray) {
    this.txid = tx.txid;
    this.fee = tx.fee;
    this.vsize = tx.vsize;
    this.value = tx.value;
    this.feerate = tx.fee / tx.vsize;
    this.status = tx.status;
    this.initialised = false;
    this.vertexArray = vertexArray;

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
    // Block audit
    if (this.status === 'found') {
      // return hexToColor('1a4987');
    } else if (this.status === 'missing') {
      return hexToColor('039BE5');
    } else if (this.status === 'added') {
      return hexToColor('D81B60');
    }

    // Block component
    const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, this.feerate) < feeLvl) - 1;
    return hexToColor(mempoolFeeColors[feeLevelIndex] || mempoolFeeColors[mempoolFeeColors.length - 1]);
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
