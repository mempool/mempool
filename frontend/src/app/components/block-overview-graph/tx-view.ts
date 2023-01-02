import TxSprite from './tx-sprite';
import { FastVertexArray } from './fast-vertex-array';
import { TransactionStripped } from '../../interfaces/websocket.interface';
import { SpriteUpdateParams, Square, Color, ViewUpdateParams } from './sprite-types';
import { feeLevels } from '../../app.constants';
import { ThemeService } from 'src/app/services/theme.service';

const hoverTransitionTime = 300;

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
  status?: 'found' | 'missing' | 'fresh' | 'added' | 'censored' | 'selected';
  context?: 'projected' | 'actual';
  theme: ThemeService;

  initialised: boolean;
  vertexArray: FastVertexArray;
  hover: boolean;
  sprite: TxSprite;
  hoverColor: Color | void;

  screenPosition: Square;
  gridPosition: Square | void;

  dirty: boolean;

  constructor(tx: TransactionStripped, vertexArray: FastVertexArray, theme: ThemeService) {
    this.context = tx.context;
    this.txid = tx.txid;
    this.fee = tx.fee;
    this.vsize = tx.vsize;
    this.value = tx.value;
    this.feerate = tx.fee / tx.vsize;
    this.status = tx.status;
    this.initialised = false;
    this.vertexArray = vertexArray;
    this.theme = theme;

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
  setHover(hoverOn: boolean, color: Color | void): number {
    if (hoverOn) {
      this.hover = true;
      this.hoverColor = color || this.theme.defaultHoverColor;

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
    const feeLevelIndex = feeLevels.findIndex((feeLvl) => Math.max(1, this.feerate) < feeLvl) - 1;
    const feeLevelColor = this.theme.feeColors[feeLevelIndex] || this.theme.feeColors[this.theme.mempoolFeeColors.length - 1];
    // Block audit
    switch(this.status) {
      case 'censored':
        return this.theme.auditColors.censored;
      case 'missing':
        return this.theme.auditColors.missing;
      case 'fresh':
        return this.theme.auditColors.missing;
      case 'added':
        return this.theme.auditColors.added;
      case 'selected':
        return this.theme.auditColors.selected;
      case 'found':
        if (this.context === 'projected') {
          return this.theme.auditFeeColors[feeLevelIndex] || this.theme.auditFeeColors[this.theme.mempoolFeeColors.length - 1];
        } else {
          return feeLevelColor;
        }
      default:
        return feeLevelColor;
    }
  }
}
