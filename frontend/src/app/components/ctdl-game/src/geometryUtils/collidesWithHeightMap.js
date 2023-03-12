import { intersects } from './intersects';

/**
 * @description Method to check if an anchor point is inside heightmap
 * @param {Object} anchor anchor object for testing
 * @param {Object} point Object that has heightMask
 * @returns {Boolean} true if anchor point collides
 */
export const collidesWithHeightMap = (anchor, point) => {
  const heightMap = point.getHeightMap();

  for (let i = 2; i > 0; i--) {
    const anchorPoint = {
      ...anchor,
      x: anchor.x + (i === 2 ? anchor.w : 0)
    };

    if (intersects(anchorPoint, point.getBoundingBox())) {
      const touchPoint = {
        x: anchorPoint.x - point.x,
        y: anchorPoint.y - point.y
      };

      const isSolid = !heightMap[touchPoint.y] || heightMap[touchPoint.y][touchPoint.x] > 0;
      if (isSolid) return true;
    }
  }
  return false;
};