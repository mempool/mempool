import TxSprite from '@components/block-overview-graph/tx-sprite';
import { FastVertexArray } from '@components/block-overview-graph/fast-vertex-array';
import { SpriteUpdateParams, Square, Color, ViewUpdateParams } from '@components/block-overview-graph/sprite-types';
import { hexToColor } from '@components/block-overview-graph/utils';
import BlockScene from '@components/block-overview-graph/block-scene';
import { TransactionStripped } from '@interfaces/node-api.interface';
import { TransactionFlags } from '@app/shared/filters.utils';

const hoverTransitionTime = 300;
const defaultHoverColor = hexToColor('1bd8f4');
const defaultHighlightColor = hexToColor('800080');

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
  acc?: boolean;
  rate?: number;
  flags: number;
  bigintFlags?: bigint | null = 0b00000100_00000000_00000000_00000000n;
  time?: number;
  status?: 'found' | 'missing' | 'sigop' | 'fresh' | 'freshcpfp' | 'added' | 'added_prioritized' | 'prioritized' | 'added_deprioritized' | 'deprioritized' | 'censored' | 'selected' | 'rbf' | 'accelerated';
  context?: 'projected' | 'actual';
  scene?: BlockScene;

  initialised: boolean;
  vertexArray: FastVertexArray;
  hover: boolean;
  highlight: boolean;
  sprite: TxSprite;
  hoverColor: Color | void;
  highlightColor: Color | void;

  screenPosition: Square;
  gridPosition: Square | void;

  dirty: boolean;

  constructor(tx: TransactionStripped, scene: BlockScene) {
    this.scene = scene;
    this.context = tx.context;
    this.txid = tx.txid;
    this.time = tx.time || 0;
    this.fee = tx.fee;
    this.vsize = tx.vsize;
    this.value = tx.value;
    this.feerate = tx.rate || (tx.fee / tx.vsize); // sort by effective fee rate where available
    this.acc = tx.acc;
    this.rate = tx.rate;
    this.status = tx.status;
    this.flags = tx.flags || 0;
    this.bigintFlags = tx.flags ? (BigInt(tx.flags) | (this.acc ? TransactionFlags.acceleration : 0n)): 0n;
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
      if (this.highlight) {
        this.setHighlight(true, this.highlightColor);
      } else {
        if (this.sprite) {
          this.sprite.resume(hoverTransitionTime);
        }
      }
    }
    this.dirty = false;
    return performance.now() + hoverTransitionTime;
  }

  // Temporarily override the tx color
  // returns minimum transition end time
  setHighlight(highlightOn: boolean, color: Color | void = defaultHighlightColor): number {
    if (highlightOn) {
      this.highlight = true;
      this.highlightColor = color;

      this.sprite.update({
        ...this.highlightColor,
        duration: hoverTransitionTime,
        adjust: false,
        temp: true
      });
    } else {
      this.highlight = false;
      this.highlightColor = null;
      if (this.hover) {
        this.setHover(true, this.hoverColor);
      } else {
        if (this.sprite) {
          this.sprite.resume(hoverTransitionTime);
        }
      }
    }
    this.dirty = false;
    return performance.now() + hoverTransitionTime;
  }
}
