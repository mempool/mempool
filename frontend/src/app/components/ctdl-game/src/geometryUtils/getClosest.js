/**
 * @description Method to determine which object is the closest to given object
 * @param {Object} point point determine proximity for
 * @param {Object[]} objects objects to inspect
 * @returns {Object} closest object to given rectangle
 */
export const getClosest = (obj1, objects) => {
  const centerX = obj1.x;
  objects = objects.sort((a, b) => Math.abs(a.getCenter().x - centerX) > Math.abs(b.getCenter().x - centerX) ? 1 : -1);
  return objects[0];
};