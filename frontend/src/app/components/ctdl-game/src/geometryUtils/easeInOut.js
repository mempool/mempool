/**
 * @description Ease In Out function
 * @param {Number} x x value
 * @param {Number} a amplifier
 * @returns {Number} y value
 */
export const easeInOut = (x, a) => Math.pow(x, a) / (Math.pow(x, a) + Math.pow(1 - x, a));

/**
 * @description Ease Out Bounce function
 * @param {Number} x x value
 * @returns {Number} y value
*/
export const easeOutBounce = x => {
  const n1 = 7.5625;
  const d1 = 2.75;

  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75;
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375;
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
};

/**
 * @description Ease In Out Bounce function
 * @param {Number} x x value
 * @returns {Number} y value
*/
export const easeInOutBounce = x => x < 0.5
  ? (1 - easeOutBounce(1 - 2 * x)) / 2
  : (1 + easeOutBounce(2 * x - 1)) / 2;