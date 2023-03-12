import constants from '../constants';
import { CTDLGAME } from '../gameUtils';

/**
 * @description Method to draw light sources on map
 * @param {Object} lightSources array of light sources
 * @param {String} mapAsset the asset for the map
 * @param {Number} tileSize size of tiles
 * @param {Number} [intensity] light intensity
 * @param {Boolean} [glows] if true draw object bright
 */
export const drawLightSources = (lightSources, mapAsset, tileSize, intensity = 1, glows = true) => {
  if (!lightSources) return;
  constants.skyContext.globalAlpha = .0125 * intensity;
  constants.skyContext.globalCompositeOperation = 'source-atop';

  constants.bgContext.globalAlpha = .025 * intensity;
  constants.bgContext.globalCompositeOperation = 'source-atop';

  constants.fgContext.globalAlpha = .025 * intensity;
  constants.fgContext.globalCompositeOperation = 'source-atop';

  constants.charContext.globalAlpha = .025 * intensity;
  constants.charContext.globalCompositeOperation = 'source-atop';

  constants.gameContext.globalAlpha = .025 * intensity;
  constants.gameContext.globalCompositeOperation = 'source-atop';

  const objectLightSources = CTDLGAME.objects
    .filter(obj => obj.glows && obj.getLightSource)
    .map((obj => obj.getLightSource()))

  ;(CTDLGAME.lightSources || []).concat(objectLightSources)
    .filter(lightSource => lightSource)
    .map(lightSource => {
      const x = lightSource.id ? lightSource.x : lightSource.x + .5 * tileSize;
      const y = lightSource.id ? lightSource.y : lightSource.y + .5 * tileSize;
      const radius = lightSource.radius || 64;
      constants.skyContext.fillStyle = lightSource.color;
      constants.bgContext.fillStyle = lightSource.color;
      constants.fgContext.fillStyle = lightSource.color;
      constants.charContext.fillStyle = lightSource.color;
      constants.gameContext.fillStyle = lightSource.color;

      for (let b = lightSource.brightness; b > 0; b -= .025) {
        [
          constants.skyContext,
          constants.bgContext,
          constants.fgContext,
          constants.charContext,
          constants.gameContext
        ].map(context => {
          context.beginPath();
          context.arc(x, y, radius * b, 0, 2 * Math.PI);
          context.fill();
        });
      }
    })

  ;
  [
    constants.skyContext,
    constants.bgContext,
    constants.fgContext,
    constants.charContext,
    constants.gameContext
  ].map(context => {
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  });

  if (glows) {
    lightSources.map(lightSource => {
      constants.bgContext.drawImage(
        CTDLGAME.assets[mapAsset],
        lightSource.tile[0] * tileSize, lightSource.tile[1] * tileSize, tileSize, tileSize,
        lightSource.x, lightSource.y + 2, tileSize, tileSize
      );
    });
  }
  CTDLGAME.objects
    .filter(obj => obj.glows)
    .map(obj => obj.draw());
};

export default drawLightSources;