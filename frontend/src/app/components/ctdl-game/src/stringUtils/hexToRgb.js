// Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
export const hexToRgb = hex => {
  hex = hex.replace(shorthandRegex, (m, r, g, b) =>  r + r + g + g + b + b);

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

export default hexToRgb;