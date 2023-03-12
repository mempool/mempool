import { sharpLine } from './sharpLine';

/**
 * @description Method to render polygon
 * @param {Context} context context to render only
 * @param {Number} x0 start point x
 * @param {Number} x1 end point x
 * @param {Number} y y point
 * @param {Number} freq frequency
 * @param {Number} amplitude amplitude
 * @param {Number} shift shift
 * @returns {void}
 */
export const drawSine = (context, x0, x1, y, freq, amplitude, shift) => {
  context.moveTo(x0, y);

  for (let i = 0; i < x1 - x0; i++) {
    context.lineTo(x0 + i, y + amplitude * Math.sin((i * freq + shift) / 360));
  }
};
/**
 * @description Method to render polygon
 * @param {Context} context context to render only
 * @param {Number} x0 start point x
 * @param {Number} x1 end point x
 * @param {Number} y y point
 * @param {Number} freq frequency
 * @param {Number} amplitude amplitude
 * @param {Number} shift shift
 * @returns {void}
 */
export const drawCrispSine = (context, x0, x1, y, freq, amplitude, shift) => {
  let lastX;
  let lastY;
  for (let i = 0; i < x1 - x0; i++) {
    const newX = Math.round(x0 + i);
    const newY = y + Math.round(amplitude * Math.sin((i * freq + shift) / 360));
    if (lastX) {
      sharpLine(
        context,
        lastX, lastY,
        newX, newY
      );
    }

    lastX = newX;
    lastY = newY;
  }
};