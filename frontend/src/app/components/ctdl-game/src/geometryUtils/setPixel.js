/**
 * @description Method to set a pixel on canvas
 * @param {Context} context canvas Context
 * @param {Number} x point
 * @param {Number} y point
 */
export const setPixel = (context, x, y) => {
  context.fillRect(x, y, 1, 1);
};