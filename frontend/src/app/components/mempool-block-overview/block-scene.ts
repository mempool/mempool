import TxSprite from './tx-sprite'
import TxView from './tx-view'
import { Position, Square } from './sprite-types'

export default class BlockScene {
  scene: { count: number, offset: { x: number, y: number}};
  txs: { [key: string]: TxView };
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
  dirty: boolean;

  constructor ({ width, height, resolution, blockLimit }: { width: number, height: number, resolution: number, blockLimit: number}) {
    this.init({ width, height, resolution, blockLimit })
  }

  destroy (): void {
    Object.values(this.txs).forEach(tx => tx.destroy())
  }

  resize ({ width = this.width, height = this.height }: { width?: number, height?: number}): void {
    this.width = width
    this.height = height
    this.gridSize = this.width / this.gridWidth
    this.unitPadding =  Math.floor(Math.max(1, width / 1000))
    this.unitWidth = this.gridSize - (this.unitPadding * 2)

    this.dirty = true
    if (this.initialised && this.scene) this.updateAll(performance.now())
  }

  // Animate new block entering scene
  enter (txs: TxView[], direction) {
    this.replace(txs, [], direction)
  }

  // Animate block leaving scene
  exit (direction: string): TxView[] {
    const removed = []
    const startTime = performance.now()
    Object.values(this.txs).forEach(tx => {
      this.remove(tx.txid, startTime, direction)
      removed.push(tx)
    })
    return removed
  }

  // Reset layout and replace with new set of transactions
  replace (txs: TxView[], remove: TxView[], direction: string = 'left'): void {
    const startTime = performance.now()
    this.removeBatch(remove.map(tx => tx.txid), startTime, direction)

    // clean up sprites
    setTimeout(() => {
      remove.forEach(tx => {
        tx.destroy()
      })
    }, 1000)

    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight })

    txs.sort((a,b) => { return b.feerate - a.feerate }).forEach(tx => {
      this.insert(tx, startTime, direction)
    })
  }

  //return the tx at this screen position, if any
  getTxAt (position: Position): TxView | void {
    if (this.layout) {
      const gridPosition = this.screenToGrid(position)
      return this.layout.getTx(gridPosition)
    } else return null
  }

  private init ({ width, height, resolution, blockLimit }: { width: number, height: number, resolution: number, blockLimit: number}): void {
    this.scene = {
      count: 0,
      offset: {
        x: 0,
        y: 0
      }
    }

    // Set the scale of the visualization (with a 5% margin)
    this.vbytesPerUnit = blockLimit / Math.pow(resolution / 1.05, 2)
    this.gridWidth = resolution
    this.gridHeight = resolution
    this.resize({ width, height })
    this.layout = new BlockLayout({ width: this.gridWidth, height: this.gridHeight })

    this.txs = {}

    this.initialised = true
    this.dirty = true
  }

  private insert (tx: TxView, startTime: number, direction: string = 'left'): void {
    this.txs[tx.txid] = tx
    this.place(tx)
    this.updateTx(tx, startTime, direction)
  }

  private updateTx (tx: TxView, startTime: number, direction: string = 'left'): void {
    if (tx.dirty || this.dirty) {
      this.saveGridToScreenPosition(tx)
      this.setTxOnScreen(tx, startTime, direction)
    }
  }

  private setTxOnScreen (tx: TxView, startTime: number, direction: string = 'left'): void {
    if (!tx.initialised) {
      const txColor = tx.getColor()
      tx.update({
        display: {
          position: {
            x: tx.screenPosition.x + (direction == 'right' ? -this.width : this.width) * 1.4,
            y: tx.screenPosition.y,
            s: tx.screenPosition.s
          },
          color: txColor,
        },
        start: startTime,
        delay: 0,
      })
      tx.update({
        display: {
          position: tx.screenPosition,
          color: txColor
        },
        duration: 1000,
        start: startTime,
        delay: 50,
      })
    } else {
      tx.update({
        display: {
          position: tx.screenPosition
        },
        duration: 1000,
        minDuration: 1000,
        start: startTime,
        delay: 50,
      })
    }
  }

  private updateAll (startTime: number, direction: string = 'left'): void {
    this.scene.count = 0
    const ids = this.getTxList()
    startTime = startTime || performance.now()
    for (let i = 0; i < ids.length; i++) {
      this.updateTx(this.txs[ids[i]], startTime, direction)
    }
    this.dirty = false
  }

  private remove (id: string, startTime: number, direction: string = 'left'): TxView | void {
    const tx = this.txs[id]
    if (tx) {
      this.layout.remove(tx)
      tx.update({
        display: {
          position: {
            x: tx.screenPosition.x + (direction == 'right' ? this.width : -this.width) * 1.4,
            y: this.txs[id].screenPosition.y,
          }
        },
        duration: 1000,
        start: startTime,
        delay: 50
      })
    }
    delete this.txs[id]
    return tx
  }

  private getTxList (): string[] {
    return Object.keys(this.txs)
  }

  private saveGridToScreenPosition (tx: TxView): void {
    tx.screenPosition = this.gridToScreen(tx.gridPosition)
  }

  // convert grid coordinates to screen coordinates
  private gridToScreen (position: Square | void): Square {
    if (position) {
      const slotSize = (position.s * this.gridSize)
      const squareSize = slotSize - (this.unitPadding * 2)

      // The grid is laid out notionally left-to-right, bottom-to-top
      // So we rotate 90deg counterclockwise then flip the y axis
      //
      //    grid                             screen
      //  ________          ________        ________
      // |        |        |       b|      |       a|
      // |        | rotate |        | flip |     c  |
      // |  c     |   -->  |      c |  --> |        |
      // |a______b|        |_______a|      |_______b|
      return {
        x: this.width + (this.unitPadding * 2) - (this.gridSize * position.y) - slotSize,
        y: this.height - ((this.gridSize * position.x) + (slotSize - this.unitPadding)),
        s: squareSize
      }
    } else {
      return { x: 0, y: 0, s: 0 }
    }
  }

  screenToGrid (position: Position): Position {
    const grid = {
      x: Math.floor((position.y - this.unitPadding) / this.gridSize),
      y: Math.floor((this.width + (this.unitPadding * 2) - position.x) / this.gridSize)
    }
    return grid
  }

  // calculates and returns the size of the tx in multiples of the grid size
  private txSize (tx: TxView): number {
    let scale = Math.max(1,Math.round(Math.sqrt(tx.vsize / this.vbytesPerUnit)))
    return Math.min(this.gridWidth, Math.max(1, scale)) // bound between 1 and the max displayable size (just in case!)
  }

  private place (tx: TxView): void {
    const size = this.txSize(tx)
    this.layout.insert(tx, size)
  }

  private removeBatch (ids: string[], startTime: number, direction: string = 'left'): (TxView | void)[] {
    if (!startTime) startTime = performance.now()
    return ids.map(id => {
      return this.remove(id, startTime, direction)
    }).filter(tx => !!tx)
  }
}


class Slot {
  l: number
  r: number
  w: number

  constructor (l: number, r: number) {
    this.l = l
    this.r = r
    this.w = r - l
  }

  intersects (slot: Slot): boolean {
    return !((slot.r <= this.l) || (slot.l >= this.r))
  }

  subtract (slot: Slot): Slot[] | void {
    if (this.intersects(slot)) {
      // from middle
      if (slot.l > this.l && slot.r < this.r) {
        return [
          new Slot(this.l, slot.l),
          new Slot(slot.r, this.r)
        ]
      } // totally covered
      else if (slot.l <= this.l && slot.r >= this.r) {
        return []
      } // from left side
      else if (slot.l <= this.l) {
        if (slot.r == this.r) return []
        else return [new Slot(slot.r, this.r)]
      } // from right side
      else if (slot.r >= this.r) {
        if (slot.l == this.l) return []
        else return [new Slot(this.l, slot.l)]
      }
    } else return [this]
  }
}

class TxSlot extends Slot {
  tx: TxView

  constructor (l: number, r: number, tx: TxView) {
    super(l, r)
    this.tx = tx
  }
}

class Row {
  y: number
  w: number
  filled: TxSlot[]
  slots: Slot[]


  constructor (y: number, width: number) {
    this.y = y
    this.w = width
    this.filled = []
    this.slots = [new Slot(0, this.w)]
  }

  // insert a transaction w/ given width into row starting at position x
  insert (x: number, w: number, tx: TxView): void {
    const newSlot = new TxSlot(x, x + w, tx)
    // insert into filled list
    let index = this.filled.findIndex((slot) => { return slot.l >= newSlot.r })
    if (index < 0) index = this.filled.length
    this.filled.splice(index || 0, 0, newSlot)
    // subtract from overlapping slots
    for (let i = 0; i < this.slots.length; i++) {
      if (newSlot.intersects(this.slots[i])) {
        const diff = this.slots[i].subtract(newSlot)
        if (diff) {
          this.slots.splice(i, 1, ...diff)
          i += diff.length - 1
        }
      }
    }
  }

  remove (x: number, w: number): void {
    const txIndex = this.filled.findIndex((slot) => { return slot.l == x })
    this.filled.splice(txIndex, 1)

    const newSlot = new Slot(x, x + w)
    let slotIndex = this.slots.findIndex((slot) => { return slot.l >= newSlot.r })
    if (slotIndex < 0) slotIndex = this.slots.length
    this.slots.splice(slotIndex || 0, 0, newSlot)
    this.normalize()
  }

  // merge any contiguous empty slots
  private normalize (): void {
    for (let i = 0; i < this.slots.length - 1; i++) {
      if (this.slots[i].r == this.slots[i+1].l) {
        this.slots[i].r = this.slots[i+1].r
        this.slots[i].w += this.slots[i+1].w
        this.slots.splice(i+1, 1)
        i--
      }
    }
  }

  txAt (x: number): TxView | void {
    let i = 0
    while (i < this.filled.length && this.filled[i].l <= x) {
      if (this.filled[i].l <= x && this.filled[i].r > x) return this.filled[i].tx
      i++
    }
  }
}

class BlockLayout {
  width: number;
  height: number;
  rows: Row[];
  txPositions: { [key: string]: Square }


  constructor ({ width, height } : { width: number, height: number }) {
    this.width = width
    this.height = height
    this.rows = [new Row(0, this.width)]
    this.txPositions = {}
  }

  getRow (position: Square): Row {
    return this.rows[position.y]
  }

  getTx (position: Square): TxView | void {
    if (this.getRow(position)) {
      return this.getRow(position).txAt(position.x)
    }
  }

  addRow (): void {
    this.rows.push(new Row(this.rows.length, this.width))
  }

  remove (tx: TxView) {
    const position = this.txPositions[tx.txid]
    if (position) {
      for (let y = position.y; y < position.y + position.s && y < this.rows.length; y++) {
        this.rows[y].remove(position.x, position.s)
      }
    }
    delete this.txPositions[tx.txid]
  }

  insert (tx: TxView, width: number): Square {
    const fit = this.fit(tx, width)

    // insert the tx into rows at that position
    for (let y = fit.y; y < fit.y + width; y++) {
      if (y >= this.rows.length) this.addRow()
      this.rows[y].insert(fit.x, width, tx)
    }
    const position = { x: fit.x, y: fit.y, s: width }
    this.txPositions[tx.txid] = position
    tx.applyGridPosition(position)
    return position
  }

  // Find the first slot large enough to hold a transaction of this size
  fit (tx: TxView, width: number): Square {
    let fit
    for (let y = 0; y < this.rows.length && !fit; y++) {
      fit = this.findFit(0, this.width, y, y, width)
    }
    // fall back to placing tx in a new row at the top of the layout
    if (!fit) {
      fit = { x: 0, y: this.rows.length }
    }
    return fit
  }

  // recursively check rows to see if there's space for a tx (depth-first)
  // left/right: initial column boundaries to check
  // row: current row to check
  // start: starting row
  // size: size of space needed
  findFit (left: number, right: number, row: number, start: number, size: number) : Square {
    if ((row - start) >= size || row >= this.rows.length) {
      return { x: left, y: start }
    }
    for (let i = 0; i < this.rows[row].slots.length; i++) {
      const slot = this.rows[row].slots[i]
      const l = Math.max(left, slot.l)
      const r = Math.min(right, slot.r)
      if (r - l >= size) {
        const fit = this.findFit(l, r, row + 1, start, size)
        if (fit) return fit
      }
    }
  }
}
