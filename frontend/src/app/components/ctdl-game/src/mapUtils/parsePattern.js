import { flatten } from '../arrayUtils';

/**
 * @description Method to parse and flatten a pattern
 * @param {Array[]} pattern multidimensional pattern array
 * @param {Number} x x coordinate
 * @param {Number} y y coordinate
 * @returns {Object[]} flatten array of tiles
 */
export const parsePattern = (pattern, x, y) => pattern
  .map((row, r) => row.map((tile, c) => ({
    x: x + c,
    y: y + r,
    tile
  })))
  .reduce(flatten)
  .filter(tile => tile.tile);

export default parsePattern;