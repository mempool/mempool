/*
  Utility class for access and management of low-level sprite data

  Maintains a single Float32Array of sprite data, keeping track of empty slots
  to allow constant-time insertion and deletion

  Automatically resizes by copying to a new, larger Float32Array when necessary,
  or compacting into a smaller Float32Array when there's space to do so.
*/

import TxSprite from '@components/block-overview-graph/tx-sprite';

export class FastVertexArray {
  length: number;
  count: number;
  stride: number;
  sprites: TxSprite[];
  data: Float32Array;
  freeSlots: number[];
  lastSlot: number;
  dirty = false;

  constructor(length, stride) {
    this.length = length;
    this.count = 0;
    this.stride = stride;
    this.sprites = [];
    this.data = new Float32Array(this.length * this.stride);
    this.freeSlots = [];
    this.lastSlot = 0;
    this.dirty = true;
  }

  insert(sprite: TxSprite): number {
    this.count++;

    let position;
    if (this.freeSlots.length) {
      position = this.freeSlots.shift();
    } else {
      position = this.lastSlot;
      this.lastSlot++;
      if (this.lastSlot > this.length) {
        this.expand();
      }
    }
    this.sprites[position] = sprite;
    return position;
    this.dirty = true;
  }

  remove(index: number): void {
    this.count--;
    this.clearData(index);
    this.freeSlots.push(index);
    this.sprites[index] = null;
    if (this.length > 2048 && this.count < (this.length * 0.4)) {
      this.compact();
    }
    this.dirty = true;
  }

  setData(index: number, dataChunk: number[]): void {
    this.data.set(dataChunk, (index * this.stride));
    this.dirty = true;
  }

  clearData(index: number): void {
    this.data.fill(0, (index * this.stride), ((index + 1) * this.stride));
    this.dirty = true;
  }

  getData(index: number): Float32Array {
    return this.data.subarray(index, this.stride);
  }

  expand(): void {
    this.length *= 2;
    const newData = new Float32Array(this.length * this.stride);
    newData.set(this.data);
    this.data = newData;
    this.dirty = true;
  }

  compact(): void {
    // New array length is the smallest power of 2 larger than the sprite count (but no smaller than 512)
    const newLength = Math.max(512, Math.pow(2, Math.ceil(Math.log2(this.count))));
    if (newLength !== this.length) {
      this.length = newLength;
      this.data = new Float32Array(this.length * this.stride);
      let sprite;
      const newSprites = [];
      let i = 0;
      for (const index in this.sprites) {
        sprite = this.sprites[index];
        if (sprite) {
          newSprites.push(sprite);
          sprite.moveVertexPointer(i);
          sprite.compile();
          i++;
        }
      }
      this.sprites = newSprites;
      this.freeSlots = [];
      this.lastSlot = i;
    }
    this.dirty = true;
  }

  getVertexData(): Float32Array {
    return this.data;
  }
}
