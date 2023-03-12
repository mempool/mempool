export const maps = [
  'city',
  'building',
  'building2',
  'forest',
  'rainbowLand',
  'rabbitHole',
  'mempool',
  'endOfTheRabbitHole',
  'dogeCoinMine',
  'grasslands',
  'czinosCitadel',
  'mtGox',
  'capitalCity',
  'cityUnderground',
  'pier',
  'wideRiver',
  'citadel',
  'miningFarm',
  'moon',
  'craigsCastle',
  'craigsStage',
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