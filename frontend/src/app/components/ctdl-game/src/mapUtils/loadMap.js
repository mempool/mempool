export const maps = [
  'mempool',
];

/**
 * @description Method to load map settings
 * @param {String} id world id
 * @returns {Object} map object
 */
export const loadMap = async id => (await import(
  /* webpackMode: "lazy" */
  `./maps/${id}.js`
)).default;