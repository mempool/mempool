import constants from '../constants';
import { CTDLGAME } from '../gameUtils';

/**
 * @description Method to apply gravity to game objects
 * @returns {void}
 */
export const applyGravity = () => {
    if (CTDLGAME.lockCharacters) return;

    CTDLGAME.objects
      .filter(obj => obj.applyGravity)
      .filter(obj => obj.inViewport) // only apply gravity to objects in viewport
      .map(obj => obj.vy += constants.GRAVITY);

    // workaround for worst case
    if (CTDLGAME.hodlonaut.y > 1150) CTDLGAME.hodlonaut.y = 800;
    if (CTDLGAME.katoshi.y > 1150) CTDLGAME.katoshi.y = 800;
};