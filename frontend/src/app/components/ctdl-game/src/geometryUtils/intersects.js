/**
 * @description Method to check whether two rectangles intersect
 * @param {Object} r1 rectangle 1
 * @param {Object} r2 rectangle 2
 * @returns {Boolean} true if objects intersect
 */
export const intersects = (r1, r2) => !(
  r2.x > r1.x + r1.w - 1 ||
  r2.x + r2.w - 1 < r1.x ||
  r2.y > r1.y + r1.h - 1 ||
  r2.y + r2.h - 1 < r1.y
);