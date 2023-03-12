/**
 * @description Method to render polygon
 * @param {Context} context context to render only
 * @param {Object[]} coords array of coordinates to draw. First item gives starting point, successive items are relative coordinates.
 * @returns {void}
 */
export const drawPolygon = (context, coords) => {
  const pointer = coords.shift();
  context.beginPath();
  context.moveTo(pointer.x, pointer.y);
  coords.map(offset => {
    pointer.x += offset.x;
    pointer.y += offset.y;
    context.lineTo(pointer.x, pointer.y);
  });
  context.closePath();
  context.stroke();
  context.fill();
};