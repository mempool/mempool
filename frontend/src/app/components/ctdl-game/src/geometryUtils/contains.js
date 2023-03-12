/**
 * @description Method to check whether an object contains another.
 * This method checks if the center of the object is inside the other.
 * @param {Object} obj1 object that is containing
 * @param {Object} obj2 object that is contained
 */
export const contains = (obj1, obj2) => {
  return (
    obj2.x + obj2.w / 2 >= obj1.x &&
    obj2.x + obj2.w / 2 <= obj1.x + obj1.w - 1 &&
    obj2.y + obj2.h / 2 >= obj1.y &&
    obj2.y + obj2.h / 2 <= obj1.y + obj1.h - 1
  );
};