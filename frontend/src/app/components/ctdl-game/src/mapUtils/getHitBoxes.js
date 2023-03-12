import constants from '../constants';
import Ramp from '../Ramp';
import GameObject from '../GameObject';

class Tile extends GameObject {
  constructor(id, options) {
    super(id, options);
    this.tile = options.tile;
    this.tileSize = options.tileSize;
    this.x = this.tile.x * this.tileSize;
    this.y = this.tile.y * this.tileSize + 2;
    this.w = this.tileSize;
    this.h = this.tileSize;
    this.isSolid = options.isSolid;
    this.spawnPoint = options.spawnPoint;
  }
}

/**
 * @description Method to get hit boxes from map
 * @param {Object[]} layer map layer object
 * @param {Object[]} ramps array of tiles that act as ramps
 * @param {Object[]} solids array of tiles that are solid
 * @param {String} sprite sprite to use for ramps
 * @param {Number} tileSize size of tiles
 */
export const getHitBoxes = (layer, ramps, solids, spawnPoints, sprite, tileSize) => layer
  .map(tile => {
    if (ramps.indexOf(tile.tile.toString()) !== -1) {
      return new Ramp(
        `ramp-${tile.tile.join('_')}-${tile.x}_${tile.y}`,
        constants.bgContext, {
          x: tile.x * tileSize,
          y: tile.y * tileSize + 3,
          w: tileSize,
          h: tileSize,
          sprite,
          spriteData: {
            x: tile.tile[0] * tileSize,
            y: tile.tile[1] * tileSize,
            w: tileSize,
            h: tileSize
          },
          isSolid: true,
          spawnPoint: spawnPoints.indexOf(tile.tile.toString()) !== -1
        }
      );
    } else if (solids.indexOf(tile.tile.toString()) !== -1) {
      return new Tile(
        `tile-${tile.tile.join('_')}-${tile.x}_${tile.y}`,
        {
          x: tile.x * tileSize,
          y: tile.y * tileSize + 3,
          tileSize,
          tile,
          isSolid: true,
          spawnPoint: spawnPoints.indexOf(tile.tile.toString()) !== -1
        }
      );
    }
  })
  .filter(hitBox => hitBox);

export default getHitBoxes;