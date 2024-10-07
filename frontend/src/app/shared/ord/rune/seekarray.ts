/**
 * This class provides a way to read data sequentially from a Uint8Array with automatic cursor management.
 * It utilizes DataView for handling multi-byte data types.
 *
 * This replaces the SeekBuffer from the original runestone-lib!
 */
export class SeekArray {

  public seekIndex: number = 0;
  private dataView: DataView;

  /**
   * Constructs a SeekArray instance.
   *
   * @param array - The Uint8Array from which data will be read.
   */
  constructor(private array: Uint8Array) {
    this.dataView = new DataView(array.buffer, array.byteOffset, array.byteLength);
  }

  /**
   * Reads an unsigned 8-bit integer from the current position and advances the seek index by 1 byte.
   *
   * @returns The read value or undefined if reading beyond the end of the array.
   */
  readUInt8(): number | undefined {
    if (this.isFinished()) {
      return undefined;
    }
    const value = this.dataView.getUint8(this.seekIndex);
    this.seekIndex += 1;
    return value;
  }

  /**
   * Checks if the seek index has reached or surpassed the length of the underlying array.
   *
   * @returns true if there are no more bytes to read, false otherwise.
   */
  isFinished(): boolean {
    return this.seekIndex >= this.array.length;
  }
}
