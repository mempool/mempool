import { FastVertexArray } from '@components/block-overview-graph/fast-vertex-array';
import TxView from '@components/block-overview-graph/tx-view';
import { TransactionStripped } from '@interfaces/node-api.interface';
import { Color, Position, Square, ViewUpdateParams } from '@components/block-overview-graph/sprite-types';
import { defaultColorFunction, contrastColorFunction } from '@components/block-overview-graph/utils';
import { ThemeService } from '@app/services/theme.service';

export default class BlockScene {
  scene: { count: number, offset: { x: number, y: number}};
  vertexArray: FastVertexArray;
  txs: { [key: string]: TxView };
  getColor: ((tx: TxView) => Color) = defaultColorFunction;
  theme: ThemeService;
  orientation: string;
  flip: boolean;
  animationDuration: number = 1000;
  configAnimationOffset: number | null;
  animationOffset: number;
  highlightingEnabled: boolean;
  filterFlags: bigint | null = 0b00000100_00000000_00000000_00000000n;
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  vbytesPerUnit: number;
  unitPadding: number;
  unitWidth: number;
  initialised: boolean;
  layout: BlockLayout;
  animateUntil = 0;
  dirty: boolean;

  constructor({ width, height, resolution, blockLimit, animationDuration, animationOffset, orientation, flip, vertexArray, theme, highlighting, colorFunction }:
      { width: number, height: number, resolution: number, blockLimit: number, animationDuration: number, animationOffset: number,
        orientation: string, flip: boolean, vertexArray: FastVertexArray, theme: ThemeService, highlighting: boolean, colorFunction: ((tx: TxView) => Color) | null }
  ) {
    this.init({ width, height, resolution, blockLimit, animationDuration, animationOffset, orientation, flip, vertexArray, theme, highlighting, colorFunction });
  }

  resize({ width = this.width, height = this.height, animate = true }: { width?: number, height?: number, animate: boolean }): void {
    this.width = width;
    this.height = height;
    this.gridSize = this.width / this.gridWidth;
    this.unitPadding =  Math.max(1, Math.floor(this.gridSize / 5));
    this.unitWidth = this.gridSize - (this.unitPadding * 2);
    this.animationOffset = this.configAnimationOffset == null ? (this.width * 1.4) : this.configAnimationOffset;

    this.dirty = true;
    if (this.initialised && this.scene) {
      this.updateAll(performance.now(), 50, 'left', animate);
    }
  }

  setOrientation(orientation: string, flip: boolean): void {
    this.orientation = orientation;
    this.flip = flip;
    this.dirty = true;
    if (this.initialised && this.scene) {
      this.updateAll(performance.now(), 50);
    }
  }

  setHighlighting(enabled: boolean): void {
    this.highlightingEnabled = enabled;
    if (this.initialised && this.scene) {
      this.updateAll(performance.now(), 50);
    }
  }

  setColorFunction(colorFunction: ((tx: TxView) => Color) | null): void {
    this.theme.theme === 'contrast' || this.theme.theme === 'bukele' ? this.getColor = colorFunction || contrastColorFunction : this.getColor = colorFunction || defaultColorFunction;
    this.updateAllColors();
  }

  updateAllColors(): void {
    this.dirty = true;
    if (this.initialised && this.scene) {
      this.updateColors(performance.now(), 50);
    }
  }

  // Destroy the current layout and clean up graphics sprites without any exit animation
  destroy(): void {
    Object.values(this.txs).forEach(tx => tx.destroy());
    this.txs = {};
    this.layout = null;
  }

  // set up the scene with an initial set of transactions, without any transition animation
  setup(txs: TransactionStripped[], sort: boolean = false) {
    // clean up any old transactions
    Object.values(this.txs).forEach(tx => {
      tx.destroy();
      delete this.txs[tx.txid];
    });
    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight });
    let txViews = txs.map(tx => new TxView(tx, this));
    if (sort) {
      txViews = txViews.sort(feeRateDescending);
    }
    txViews.forEach(txView => {
      this.txs[txView.txid] = txView;
      this.place(txView);
      this.saveGridToScreenPosition(txView);
      this.applyTxUpdate(txView, {
        display: {
          position: txView.screenPosition,
          color: this.getColor(txView)
        },
        duration: 0
      });
    });
  }

  // Animate new block entering scene
  enter(txs: TransactionStripped[], direction, startTime?: number) {
    this.replace(txs, direction, false, startTime);
  }

  // Animate block leaving scene
  exit(direction: string): void {
    const startTime = performance.now();
    const removed = this.removeBatch(Object.keys(this.txs), startTime, direction);

    // clean up sprites
    setTimeout(() => {
      removed.forEach(tx => {
        tx.destroy();
      });
    }, 2000);
  }

  // Reset layout and replace with new set of transactions
  replace(txs: TransactionStripped[], direction: string = 'left', sort: boolean = true, startTime: number = performance.now()): void {
    const nextIds = {};
    const remove = [];
    txs.forEach(tx => {
      nextIds[tx.txid] = true;
    });
    Object.keys(this.txs).forEach(txid => {
      if (!nextIds[txid]) {
        remove.push(txid);
      }
    });
    txs.forEach(tx => {
      if (!this.txs[tx.txid]) {
        this.txs[tx.txid] = new TxView(tx, this);
      }
    });

    const removed = this.removeBatch(remove, startTime, direction);

    // clean up sprites
    setTimeout(() => {
      removed.forEach(tx => {
        tx.destroy();
      });
    }, (startTime - performance.now()) + this.animationDuration + 1000);

    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight });

    if (sort) {
      Object.values(this.txs).sort(feeRateDescending).forEach(tx => {
        this.place(tx);
      });
    } else {
      txs.forEach(tx => {
        this.place(this.txs[tx.txid]);
      });
    }

    this.updateAll(startTime, 50, direction);
  }

  update(add: TransactionStripped[], remove: string[], change: { txid: string, rate: number | undefined, acc: boolean | undefined }[], direction: string = 'left', resetLayout: boolean = false): void {
    const startTime = performance.now();
    const removed = this.removeBatch(remove, startTime, direction);

    // clean up sprites
    setTimeout(() => {
      removed.forEach(tx => {
        tx.destroy();
      });
    }, (startTime - performance.now()) + this.animationDuration + 1000);

    if (resetLayout) {
      add.forEach(tx => {
        if (!this.txs[tx.txid]) {
          this.txs[tx.txid] = new TxView(tx, this);
        }
      });
      this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight });
      Object.values(this.txs).sort(feeRateDescending).forEach(tx => {
        this.place(tx);
      });
    } else {
      // update effective rates
      change.forEach(tx => {
        if (this.txs[tx.txid]) {
          this.txs[tx.txid].acc = tx.acc;
          this.txs[tx.txid].feerate = tx.rate || (this.txs[tx.txid].fee / this.txs[tx.txid].vsize);
          this.txs[tx.txid].rate = tx.rate;
          this.txs[tx.txid].dirty = true;
          this.updateColor(this.txs[tx.txid], startTime, 50, true);
        }
      });

      // try to insert new txs directly
      const remaining = [];
      add.map(tx => new TxView(tx, this)).sort(feeRateDescending).forEach(tx => {
        if (!this.tryInsertByFee(tx)) {
          remaining.push(tx);
        }
      });
      this.placeBatch(remaining);
      this.layout.applyGravity();
    }

    this.updateAll(startTime, 100, direction);
  }

  // return the tx at this screen position, if any
  getTxAt(position: Position): TxView | void {
    if (this.layout) {
      const gridPosition = this.screenToGrid(position);
      return this.layout.getTx(gridPosition);
    } else {
      return null;
    }
  }

  setHover(tx: TxView, value: boolean): void {
    this.animateUntil = Math.max(this.animateUntil, tx.setHover(value));
  }

  setHighlight(tx: TxView, value: boolean): void {
    this.animateUntil = Math.max(this.animateUntil, tx.setHighlight(value));
  }

  private init({ width, height, resolution, blockLimit, animationDuration, animationOffset, orientation, flip, vertexArray, theme, highlighting, colorFunction }:
      { width: number, height: number, resolution: number, blockLimit: number, animationDuration: number, animationOffset: number,
        orientation: string, flip: boolean, vertexArray: FastVertexArray, theme: ThemeService, highlighting: boolean, colorFunction: ((tx: TxView) => Color) | null }
  ): void {
    this.animationDuration = animationDuration || this.animationDuration || 1000;
    this.configAnimationOffset = animationOffset;
    this.animationOffset = this.configAnimationOffset == null ? (this.width * 1.4) : this.configAnimationOffset;
    this.orientation = orientation;
    this.flip = flip;
    this.vertexArray = vertexArray;
    this.highlightingEnabled = highlighting;
    theme.theme === 'contrast' || theme.theme === 'bukele' ? this.getColor = colorFunction || contrastColorFunction : this.getColor = colorFunction || defaultColorFunction;
    this.theme = theme;

    this.scene = {
      count: 0,
      offset: {
        x: 0,
        y: 0
      }
    };

    // Set the scale of the visualization (with a 5% margin)
    this.vbytesPerUnit = blockLimit / Math.pow(resolution / 1.02, 2);
    this.gridWidth = resolution;
    this.gridHeight = resolution;
    this.resize({ width, height, animate: true });
    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight });

    this.txs = {};

    this.initialised = true;
    this.dirty = true;
  }

  private applyTxUpdate(tx: TxView, update: ViewUpdateParams): void {
    this.animateUntil = Math.max(this.animateUntil, tx.update(update));
  }

  private updateTxColor(tx: TxView, startTime: number, delay: number, animate: boolean = true, duration?: number): void {
    if (tx.dirty || this.dirty) {
      const txColor = this.getColor(tx);
      this.applyTxUpdate(tx, {
        display: {
          color: txColor
        },
        duration: animate ? (duration || this.animationDuration) : 1,
        start: startTime,
        delay: animate ? delay : 0,
      });
    }
  }

  private updateTx(tx: TxView, startTime: number, delay: number, direction: string = 'left', animate: boolean = true): void {
    if (tx.dirty || this.dirty) {
      this.saveGridToScreenPosition(tx);
      this.setTxOnScreen(tx, startTime, delay, direction, animate);
    }
  }

  private updateColor(tx: TxView, startTime: number, delay: number, animate: boolean = true, duration: number = 500): void {
    if (tx.dirty || this.dirty) {
      const txColor = this.getColor(tx);
      this.applyTxUpdate(tx, {
        display: {
          color: txColor,
        },
        start: startTime,
        delay,
        duration: animate ? duration : 0,
      });
    }
  }

  private setTxOnScreen(tx: TxView, startTime: number, delay: number = 50, direction: string = 'left', animate: boolean = true): void {
    if (!tx.initialised) {
      const txColor = this.getColor(tx);
      this.applyTxUpdate(tx, {
        display: {
          position: {
            x: tx.screenPosition.x + (direction === 'right' ? -this.width - this.animationOffset : (direction === 'left' ? this.width + this.animationOffset : 0)),
            y: tx.screenPosition.y + (direction === 'up' ? -this.height - this.animationOffset : (direction === 'down' ? this.height + this.animationOffset : 0)),
            s: tx.screenPosition.s
          },
          color: txColor,
        },
        start: startTime,
        delay: 0,
      });
      this.applyTxUpdate(tx, {
        display: {
          position: tx.screenPosition,
          color: txColor
        },
        duration: animate ? this.animationDuration : 1,
        start: startTime,
        delay: animate ? delay : 0,
      });
    } else {
      this.applyTxUpdate(tx, {
        display: {
          position: tx.screenPosition,
        },
        duration: animate ? this.animationDuration : 0,
        minDuration: animate ? (this.animationDuration / 2) : 0,
        start: startTime,
        delay: animate ? delay : 0,
        adjust: animate
      });
      if (!animate) {
        this.applyTxUpdate(tx, {
          display: {
            position: tx.screenPosition
          },
          duration: 0,
          minDuration: 0,
          start: startTime,
          delay: 0,
          adjust: false
        });
      }
    }
  }

  private updateAll(startTime: number, delay: number = 50, direction: string = 'left', animate: boolean = true): void {
    this.scene.count = 0;
    const ids = this.getTxList();
    startTime = startTime || performance.now();
    for (const id of ids) {
      this.updateTx(this.txs[id], startTime, delay, direction, animate);
    }
    this.dirty = false;
  }

  private updateColors(startTime: number, delay: number = 50, animate: boolean = true, duration: number = 500): void {
    const ids = this.getTxList();
    startTime = startTime || performance.now();
    for (const id of ids) {
      this.updateColor(this.txs[id], startTime, delay, animate, duration);
    }
    this.dirty = false;
  }

  private remove(id: string, startTime: number, direction: string = 'left'): TxView | void {
    const tx = this.txs[id];
    if (tx) {
      this.layout.remove(tx);
      this.applyTxUpdate(tx, {
        display: {
          position: {
            x: tx.screenPosition.x + (direction === 'right' ? this.width + this.animationOffset : (direction === 'left' ? -this.width - this.animationOffset : 0)),
            y: tx.screenPosition.y + (direction === 'up' ? this.height + this.animationOffset : (direction === 'down' ? -this.height - this.animationOffset : 0)),
          }
        },
        duration: this.animationDuration,
        start: startTime,
        delay: 50
      });
    }
    delete this.txs[id];
    return tx;
  }

  private getTxList(): string[] {
    return Object.keys(this.txs);
  }

  private saveGridToScreenPosition(tx: TxView): void {
    tx.screenPosition = this.gridToScreen(tx.gridPosition);
  }

  // convert grid coordinates to screen coordinates
  private gridToScreen(position: Square | void): Square {
    if (position) {
      const slotSize = (position.s * this.gridSize);
      const squareSize = slotSize - (this.unitPadding * 2);

      // The grid is laid out notionally left-to-right, bottom-to-top,
      // so we rotate and/or flip the y axis to match the target configuration.
      //
      // e.g. for flip = true, orientation = 'left':
      //
      //    grid                             screen
      //  ________        ________          ________
      // |        |      |        |        |       a|
      // |        | flip |        | rotate |     c  |
      // |  c     |  --> |     c  |  -->   |        |
      // |a______b|      |b______a|        |_______b|

      let x = (this.gridSize * position.x) + (slotSize / 2);
      let y = (this.gridSize * position.y) + (slotSize / 2);
      let t;
      if (this.flip) {
        x = this.width - x;
      }
      switch (this.orientation) {
        case 'left':
          t = x;
          x = this.width - y;
          y = t;
          break;
        case 'right':
          t = x;
          x = y;
          y = t;
          break;
        case 'bottom':
          y = this.height - y;
          break;
      }
      return {
        x: x + this.unitPadding - (slotSize / 2),
        y: y + this.unitPadding - (slotSize / 2),
        s: squareSize
      };
    } else {
      return { x: 0, y: 0, s: 0 };
    }
  }

  private screenToGrid(position: Position): Position {
    let x = position.x;
    let y = this.height - position.y;
    let t;

    switch (this.orientation) {
      case 'left':
        t = x;
        x = y;
        y = this.width - t;
        break;
      case 'right':
        t = x;
        x = y;
        y = t;
        break;
      case 'bottom':
        y = this.height - y;
        break;
    }
    if (this.flip) {
      x = this.width - x;
    }
    return {
      x: Math.floor(x / this.gridSize),
      y: Math.floor(y / this.gridSize)
    };
  }

  // calculates and returns the size of the tx in multiples of the grid size
  private txSize(tx: TxView): number {
    const scale = Math.max(1, Math.round(Math.sqrt(1.1 * tx.vsize / this.vbytesPerUnit)));
    return Math.min(this.gridWidth, Math.max(1, scale)); // bound between 1 and the max displayable size (just in case!)
  }

  private place(tx: TxView): void {
    const size = this.txSize(tx);
    this.layout.insert(tx, size);
  }

  private tryInsertByFee(tx: TxView): boolean {
    const size = this.txSize(tx);
    const position = this.layout.tryInsertByFee(tx, size);
    if (position) {
      this.txs[tx.txid] = tx;
      return true;
    } else {
      return false;
    }
  }

  // Add a list of transactions to the layout,
  // keeping everything approximately sorted by feerate.
  private placeBatch(txs: TxView[]): void {
    if (txs.length) {
      // grab the new tx with the highest fee rate
      txs = txs.sort(feeRateDescending);
      const maxSize = 2 * txs.reduce((max, tx) => {
        return Math.max(this.txSize(tx), max);
      }, 1);

      // find a reasonable place for it in the layout
      const root = this.layout.getReplacementRoot(txs[0].feerate, maxSize);

      // extract a sub tree of transactions from the layout, rooted at that point
      const popped = this.layout.popTree(root.x, root.y, maxSize);
      // combine those with the new transactions and sort
      txs = txs.concat(popped);
      txs = txs.sort(feeRateDescending);

      // insert everything back into the layout
      txs.forEach(tx => {
        this.txs[tx.txid] = tx;
        this.place(tx);
      });
    }
  }

  private removeBatch(ids: string[], startTime: number, direction: string = 'left'): TxView[] {
    if (!startTime) {
      startTime = performance.now();
    }
    return ids.map(id => {
      return this.remove(id, startTime, direction);
    }).filter(tx => tx != null) as TxView[];
  }
}


class Slot {
  l: number;
  r: number;
  w: number;

  constructor(l: number, r: number) {
    this.l = l;
    this.r = r;
    this.w = r - l;
  }

  intersects(slot: Slot): boolean {
    return !((slot.r <= this.l) || (slot.l >= this.r));
  }

  subtract(slot: Slot): Slot[] | void {
    if (this.intersects(slot)) {
      // from middle
      if (slot.l > this.l && slot.r < this.r) {
        return [
          new Slot(this.l, slot.l),
          new Slot(slot.r, this.r)
        ];
      } // totally covered
      else if (slot.l <= this.l && slot.r >= this.r) {
        return [];
      } // from left side
      else if (slot.l <= this.l) {
        if (slot.r === this.r) {
          return [];
        } else {
          return [new Slot(slot.r, this.r)];
        }
      } // from right side
      else if (slot.r >= this.r) {
        if (slot.l === this.l) {
          return [];
        } else {
          return [new Slot(this.l, slot.l)];
        }
      }
    } else {
      return [this];
    }
  }
}

class TxSlot extends Slot {
  tx: TxView;

  constructor(l: number, r: number, tx: TxView) {
    super(l, r);
    this.tx = tx;
  }
}

class Row {
  y: number;
  w: number;
  filled: TxSlot[];
  slots: Slot[];


  constructor(y: number, width: number) {
    this.y = y;
    this.w = width;
    this.filled = [];
    this.slots = [new Slot(0, this.w)];
  }

  // insert a transaction w/ given width into row starting at position x
  insert(x: number, w: number, tx: TxView): void {
    const newSlot = new TxSlot(x, x + w, tx);
    // insert into filled list
    let index = this.filled.findIndex((slot) => (slot.l >= newSlot.r));
    if (index < 0) {
      index = this.filled.length;
    }
    this.filled.splice(index || 0, 0, newSlot);
    // subtract from overlapping slots
    for (let i = 0; i < this.slots.length; i++) {
      if (newSlot.intersects(this.slots[i])) {
        const diff = this.slots[i].subtract(newSlot);
        if (diff) {
          this.slots.splice(i, 1, ...diff);
          i += diff.length - 1;
        }
      }
    }
  }

  remove(x: number, w: number): void {
    const txIndex = this.filled.findIndex((slot) => (slot.l === x) );
    this.filled.splice(txIndex, 1);

    const newSlot = new Slot(x, x + w);
    let slotIndex = this.slots.findIndex((slot) => (slot.l >= newSlot.r) );
    if (slotIndex < 0) {
      slotIndex = this.slots.length;
    }
    this.slots.splice(slotIndex || 0, 0, newSlot);
    this.normalize();
  }

  // merge any contiguous empty slots
  private normalize(): void {
    for (let i = 0; i < this.slots.length - 1; i++) {
      if (this.slots[i].r === this.slots[i + 1].l) {
        this.slots[i].r = this.slots[i + 1].r;
        this.slots[i].w += this.slots[i + 1].w;
        this.slots.splice(i + 1, 1);
        i--;
      }
    }
  }

  txAt(x: number): TxView | void {
    let i = 0;
    while (i < this.filled.length && this.filled[i].l <= x) {
      if (this.filled[i].l <= x && this.filled[i].r > x) {
        return this.filled[i].tx;
      }
      i++;
    }
  }

  getSlotsBetween(left: number, right: number): TxSlot[] {
    const range = new Slot(left, right);
    return this.filled.filter(slot => {
      return slot.intersects(range);
    });
  }

  slotAt(x: number): Slot | void {
    let i = 0;
    while (i < this.slots.length && this.slots[i].l <= x) {
      if (this.slots[i].l <= x && this.slots[i].r > x) {
        return this.slots[i];
      }
      i++;
    }
  }

  getAvgFeerate(): number {
    let count = 0;
    let total = 0;
    this.filled.forEach(slot => {
      if (slot.tx) {
        count += slot.w;
        total += (slot.tx.feerate * slot.w);
      }
    });
    return total / count;
  }
}

class BlockLayout {
  width: number;
  height: number;
  rows: Row[];
  txPositions: { [key: string]: Square };
  txs: { [key: string]: TxView };

  constructor({ width, height }: { width: number, height: number }) {
    this.width = width;
    this.height = height;
    this.rows = [new Row(0, this.width)];
    this.txPositions = {};
    this.txs = {};
  }

  getRow(position: Square): Row {
    return this.rows[position.y];
  }

  getTx(position: Square): TxView | void {
    if (this.getRow(position)) {
      return this.getRow(position).txAt(position.x);
    }
  }

  addRow(): void {
    this.rows.push(new Row(this.rows.length, this.width));
  }

  remove(tx: TxView) {
    const position = this.txPositions[tx.txid];
    if (position) {
      for (let y = position.y; y < position.y + position.s && y < this.rows.length; y++) {
        this.rows[y].remove(position.x, position.s);
      }
    }
    delete this.txPositions[tx.txid];
    delete this.txs[tx.txid];
  }

  insert(tx: TxView, width: number): Square {
    const fit = this.fit(tx, width);

    // insert the tx into rows at that position
    for (let y = fit.y; y < fit.y + width; y++) {
      if (y >= this.rows.length) {
        this.addRow();
      }
      this.rows[y].insert(fit.x, width, tx);
    }
    const position = { x: fit.x, y: fit.y, s: width };
    this.txPositions[tx.txid] = position;
    this.txs[tx.txid] = tx;
    tx.applyGridPosition(position);
    return position;
  }

  // Find the first slot large enough to hold a transaction of this size
  fit(tx: TxView, width: number): Square {
    let fit;
    for (let y = 0; y < this.rows.length && !fit; y++) {
      fit = this.findFit(0, this.width, y, y, width);
    }
    // fall back to placing tx in a new row at the top of the layout
    if (!fit) {
      fit = { x: 0, y: this.rows.length };
    }
    return fit;
  }

  // recursively check rows to see if there's space for a tx (depth-first)
  // left/right: initial column boundaries to check
  // row: current row to check
  // start: starting row
  // size: size of space needed
  findFit(left: number, right: number, row: number, start: number, size: number): Square {
    if ((row - start) >= size || row >= this.rows.length) {
      return { x: left, y: start };
    }
    for (const slot of this.rows[row].slots) {
      const l = Math.max(left, slot.l);
      const r = Math.min(right, slot.r);
      if (r - l >= size) {
        const fit = this.findFit(l, r, row + 1, start, size);
        if (fit) {
          return fit;
        }
      }
    }
  }

  // insert only if the tx fits into a fee-appropriate position
  tryInsertByFee(tx: TxView, size: number): Square | void {
    const fit = this.fit(tx, size);

    if (this.checkRowFees(fit.y, tx.feerate)) {
      // insert the tx into rows at that position
      for (let y = fit.y; y < fit.y + size; y++) {
        if (y >= this.rows.length) {
          this.addRow();
        }
        this.rows[y].insert(fit.x, size, tx);
      }
      const position = { x: fit.x, y: fit.y, s: size };
      this.txPositions[tx.txid] = position;
      this.txs[tx.txid] = tx;
      tx.applyGridPosition(position);
      return position;
    }
  }

  // Return the first slot with a lower feerate
  getReplacementRoot(feerate: number, width: number): Square {
    let slot;
    for (let row = 0; row <= this.rows.length; row++) {
      if (this.rows[row].slots.length > 0) {
        return { x: this.rows[row].slots[0].l, y: row };
      } else {
        slot = this.rows[row].filled.find(x => {
          return x.tx.feerate < feerate;
        });
        if (slot) {
          return { x: Math.min(slot.l, this.width - width), y: row };
        }
      }
    }
    return { x: 0, y: this.rows.length };
  }

  // remove and return all transactions in a subtree of the layout
  popTree(x: number, y: number, width: number) {
    const selected: { [key: string]: TxView } = {};
    let left = x;
    let right = x + width;
    let prevWidth = right - left;
    let prevFee = Infinity;
    // scan rows upwards within a channel bounded by 'left' and 'right'
    for (let row = y; row < this.rows.length; row++) {
      let rowMax = 0;
      const slots = this.rows[row].getSlotsBetween(left, right);
      // check each slot in this row overlapping the search channel
      slots.forEach(slot => {
        // select the associated transaction
        selected[slot.tx.txid] = slot.tx;
        rowMax = Math.max(rowMax, slot.tx.feerate);
        // widen the search channel to accommodate this slot if necessary
        if (slot.w > prevWidth) {
          left = slot.l;
          right = slot.r;
          // if this slot's tx has a higher feerate than the max in the previous row
          // (i.e. it's out of position)
          // select all txs overlapping the slot's full width in some rows *below*
          // to free up space for this tx to sink down to its proper position
          if (slot.tx.feerate > prevFee) {
            let count = 0;
            // keep scanning back down until we find a full row of higher-feerate txs
            for (let echo = row - 1; echo >= 0 && count < slot.w; echo--) {
              const echoSlots = this.rows[echo].getSlotsBetween(slot.l, slot.r);
              count = 0;
              echoSlots.forEach(echoSlot => {
                selected[echoSlot.tx.txid] = echoSlot.tx;
                if (echoSlot.tx.feerate >= slot.tx.feerate) {
                  count += echoSlot.w;
                }
              });
            }
          }
        }
      });
      prevWidth = right - left;
      prevFee = rowMax;
    }

    const txList = Object.values(selected);

    txList.forEach(tx => {
      this.remove(tx);
    });
    return txList;
  }

  // Check if this row has high enough avg fees
  // for a tx with this feerate to make sense here
  checkRowFees(row: number, targetFee: number): boolean {
    // first row is always fine
    if (row === 0 || !this.rows[row]) {
      return true;
    }
    return (this.rows[row].getAvgFeerate() > (targetFee * 0.9));
  }

  // drop any free-floating transactions down into empty spaces
  applyGravity(): void {
    Object.entries(this.txPositions).sort(([keyA, posA], [keyB, posB]) => {
      return posA.y - posB.y || posA.x - posB.x;
    }).forEach(([txid, position]) => {
      // see how far this transaction can fall
      let dropTo = position.y;
      while (dropTo > 0 && !this.rows[dropTo - 1].getSlotsBetween(position.x, position.x + position.s).length) {
        dropTo--;
      }
      // if it can fall at all
      if (dropTo < position.y) {
        // remove and reinsert in the row we found
        const tx = this.txs[txid];
        this.remove(tx);
        this.insert(tx, position.s);
      }
    });
  }
}

function feeRateDescending(a: TxView, b: TxView) {
  return b.feerate - a.feerate;
}
