/**
 * @description Method to parse tile into a tile object
 * @param {Object} tile tile objects
 * @param {Number} tileSize tile size in pixels
 * @returns {Object} tile object
 */
export const mapTile = (tile, tileSize) => ({
  ...tile,
  tile: tile.tile.map(coord => coord * tileSize),
  x: tile.x * tileSize,
  y: tile.y * tileSize + 2,
  w: tileSize,
  h: tileSize
});

export default mapTile;