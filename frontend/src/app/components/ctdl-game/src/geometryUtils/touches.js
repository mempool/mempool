import { intersects } from './intersects';

/**
 * @description Method to check whether two objects touch but do not intersect.
 * @param {Object} obj1 object1
 * @param {Object} obj2 object2
 * @returns {Boolean} true if two objects touch
 */
export const touches = (obj1, obj2) => {
  const feelingObj = {
    x: obj1.x - 1,
    y: obj1.y - 1,
    w: obj1.w + 2,
    h: obj1.h + 2
  };
  return !intersects(obj1, obj2) && intersects(feelingObj, obj2);
};