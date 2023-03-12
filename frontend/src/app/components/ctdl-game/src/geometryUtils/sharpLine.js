import { setPixel } from './setPixel';

/**
 * @description Method to render a sharp line without anti aliasing
 * Refer to: http://rosettacode.org/wiki/Bitmap/Bresenham's_line_algorithm#JavaScript
 * @param {Context} context canvas context
 * @param {Number} x0 start point x
 * @param {Number} y0 start point y
 * @param {Number} x1 end point x
 * @param {Number} y1 end point y
 * @returns {void}
 **/
export const sharpLine = (context, x0, y0, x1, y1) => {
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = (dx > dy ? dx : -dy) / 2;
  let i = 0;

  while (i < 1000) {
    i++;
    setPixel(context, x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = err;
    if (e2 > -dx) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dy) {
      err += dx;
      y0 += sy;
    }
  }
};