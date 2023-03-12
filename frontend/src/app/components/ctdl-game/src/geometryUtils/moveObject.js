import constants from '../constants';
import { collidesWithHeightMap } from './collidesWithHeightMap';
import { intersects } from './intersects';

/**
 * @description Method to move object while respecting collisions
 * @param {Object} object object to be moved
 * @param {Object} vector vector with x, y
 * @param {QuadTree} tree the quad tree
 * @returns {Boolean} if true object has collided
 */
const moveAndCheck = (object, vector, tree) => {
  let hasCollided = false;
  while (vector.x || vector.y) {
    object.x += vector.x ? vector.x / Math.abs(vector.x) : 0;
    object.y += vector.y ? vector.y / Math.abs(vector.y) : 0;

    hasCollided = tree.query(object.getBoundingBox())
        .filter(point => point.isSolid)
        .filter(point => intersects(object.getBoundingBox(), point.getBoundingBox()))
        .some(point => {
          if (!point.getHeightMap) return true;

          // check if heightmap reveils more information
          const anchor = object.getAnchor();

          return collidesWithHeightMap(anchor, point);
        });

    if (window.DRAWSENSORS) {
      constants.menuContext.globalAlpha = 1;
      constants.menuContext.fillStyle = `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
      constants.menuContext.fillRect(object.getAnchor().x, object.getAnchor().y, 1, 1);
      constants.menuContext.fillRect(object.getAnchor().x + object.getAnchor().w, object.getAnchor().y, 1, 1);
    }
    // has collided, roll back change and exit
    if (hasCollided) {
      object.x -= vector.x ? vector.x / Math.abs(vector.x) : 0;
      object.y -= vector.y ? vector.y / Math.abs(vector.y) : 0;

      return hasCollided;
    } else {
      // reduce vector for next round
      if (vector.x > 0) vector.x--;
      if (vector.x < 0) vector.x++;
      if (vector.y > 0) vector.y--;
      if (vector.y < 0) vector.y++;
    }
  }

  return hasCollided;
};

/**
 * @description Method to move object while respecting collisions
 * @param {Object} object object to be moved
 * @param {Object} vector vector with x, y
 * @param {QuadTree} tree the quad tree
 * @returns {Boolean} if true object has collided
 */
export const moveObject = (object, vector, tree) => {
  let hasCollided = true;
  const isVertical = vector.y && !vector.x;

  if (!isVertical) {
    // is not pure vertical movement, do the routine of walking slopes
    for (let i = 0; i < 7; i++) {
      const vectorCopy = JSON.parse(JSON.stringify(vector));
      const originalX = object.x;
      const originalY = object.y;
      object.y -= i;

      // check if object collides on move
      if (moveAndCheck(object, vectorCopy, tree)) {
        // collided, roll back change
        if (i !== 3) object.x = originalX;
        object.y = originalY;
       } else {
        // does not collide, all good
        hasCollided = false;
        break;
      }
    }
  } else {
    hasCollided = moveAndCheck(object, vector, tree);
  }

  if (hasCollided && isVertical) {
    object.vy = 0;
  }

  return hasCollided;
};