import TxView from './tx-view';
import { TransactionClassified } from '../../api/mempool-api.interfaces';
import { defaultColorFunction, contrastColorFunction, Color, Position, Square } from './utils';

export default class BlockScene {
  scene: { count: number, offset: { x: number, y: number}};
  txs: { [key: string]: TxView };
  getColor: ((tx: TxView) => Color) = defaultColorFunction;
  highlightingEnabled = false;
  orientation: string;
  flip: boolean;
  filterFlags: bigint | null = 0b00000100_00000000_00000000_00000000n;
  width: number;
  height: number;
  gridWidth: number;
  gridHeight: number;
  gridSize: number;
  vbytesPerUnit: number;
  unitPadding: number;
  unitWidth: number;
  layout: BlockLayout;

  constructor({ width, height, resolution, blockLimit, orientation, flip, theme, colorFunction, highlightingEnabled }:
      { width: number, height: number, resolution: number, blockLimit: number,
        orientation: string, flip: boolean, theme: string, colorFunction: ((tx: TxView) => Color) | null, highlightingEnabled: boolean }
  ) {
    // Set the scale of the visualization (with a 5% margin)
    this.vbytesPerUnit = blockLimit / Math.pow(resolution / 1.02, 2);
    this.gridWidth = resolution;
    this.gridHeight = resolution;

    this.width = width;
    this.height = height;
    this.gridSize = this.width / this.gridWidth;
    this.unitPadding =  Math.max(1, Math.floor(this.gridSize / 5));
    this.unitWidth = this.gridSize - (this.unitPadding * 2);
    this.orientation = orientation;
    this.flip = flip;
    theme === 'contrast' || theme === 'bukele' ? this.getColor = colorFunction || contrastColorFunction : this.getColor = colorFunction || defaultColorFunction;
    this.highlightingEnabled = highlightingEnabled;
    this.scene = {
      count: 0,
      offset: {
        x: 0,
        y: 0
      }
    };

    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight });

    this.txs = {};
  }

  // set up the scene with an initial set of transactions, without any transition animation
  setup(txs: TransactionClassified[], sort = false) {
    // clean up any old transactions
    this.txs = {};
    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight });
    let txViews = txs.map(tx => new TxView(tx, this));
    if (sort) {
      txViews = txViews.sort(feeRateDescending);
    }
    txViews.forEach(txView => {
      this.txs[txView.txid] = txView;
      this.place(txView);
      this.saveGridToScreenPosition(txView);
    });
  }

  // return the tx at this screen position, if any
  getTxAt(position: Position): TxView | void {
    if (this.layout) {
      const gridPosition = this.screenToGrid(position);
      return this.layout.getTx(gridPosition);
    } else {
      return undefined;
    }
  }

  private saveGridToScreenPosition(tx: TxView): void {
    if (tx.gridPosition) {
      tx.screenPosition = this.gridToScreen(tx.gridPosition);
    }
  }

  // convert grid coordinates to screen coordinates
  private gridToScreen(position: Square): Square {
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

  getRow(position: Position): Row {
    return this.rows[position.y];
  }

  getTx(position: Position): TxView | void {
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
  findFit(left: number, right: number, row: number, start: number, size: number): Square | undefined {
    if ((row - start) >= size || row >= this.rows.length) {
      return { x: left, y: start, s: size };
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
    return undefined;
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
        return { x: this.rows[row].slots[0].l, y: row, s: width };
      } else {
        slot = this.rows[row].filled.find(x => {
          return x.tx.feerate < feerate;
        });
        if (slot) {
          return { x: Math.min(slot.l, this.width - width), y: row, s: width };
        }
      }
    }
    return { x: 0, y: this.rows.length, s: width };
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
