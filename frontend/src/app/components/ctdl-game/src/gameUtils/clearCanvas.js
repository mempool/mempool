import constants from '../constants';
import { canDrawOn } from '../performanceUtils';
import { CTDLGAME } from './CTDLGAME';

/**
 * @description Method to clear canvas for next draw
 * @returns {void}
 */
export const clearCanvas = () => {
  if (canDrawOn('parallaxContext')) {
    constants.parallaxContext.clearRect(
      Math.round(CTDLGAME.viewport.x / 2),
      Math.round(CTDLGAME.viewport.y / 4 + (CTDLGAME.world?.h || 0) / 4 * 3 - 144),
      constants.WIDTH, constants.HEIGHT);
  }

  [
    'skyContext',
    'bgContext',
    'charContext',
    'gameContext',
    'fgContext',
    'overlayContext',
    'menuContext'
  ]
    .filter(layer => canDrawOn(layer))
    .map(layer => constants[layer])
    .map(context => {
      context.clearRect(CTDLGAME.viewport.x, CTDLGAME.viewport.y, constants.WIDTH, constants.HEIGHT);
    });
};