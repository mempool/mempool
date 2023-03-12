/**
 * @description Method to parse lights ources
 * @param {Object[]} lights lightsources by tile id
 * @param {String} color color
 * @param {Number} brightness brightness
 * @param {Object[]} layer map layer object
 * @param {Number} tileSize size of tiles
 * @returns {Object[]} light sources
 */
export const parseLightSources = (lights, layer, tileSize) => layer
.filter(tile => Object.keys(lights).indexOf(tile.tile.join('_')) !== -1)
.map(tile => {
  const light = lights[tile.tile.join('_')];
  light.tile = tile.tile;
  light.x = tile.x * tileSize;
  light.y = tile.y * tileSize;
  light.w = tileSize;
  light.h = tileSize;
  return JSON.parse(JSON.stringify(light));
});

export default parseLightSources;