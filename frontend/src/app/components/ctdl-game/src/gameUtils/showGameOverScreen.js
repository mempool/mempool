import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { write } from '../font';
import { canDrawOn } from '../performanceUtils';
import { loadGameButton, newGameButton } from '../events';

/**
 * @description Method to display progress bar
 * @param {Number} progress current progress between 0 - 1
 */
export const showGameOverScreen = () => {
  if (!canDrawOn('overlayContext')) return;

  constants.overlayContext.fillStyle = '#212121';

  constants.overlayContext.fillRect(
    CTDLGAME.viewport.x,
    CTDLGAME.viewport.y,
    constants.WIDTH,
    constants.HEIGHT
  );

  constants.overlayContext.drawImage(
    CTDLGAME.assets.gameOver,
    0, 0, 41, 21,
    CTDLGAME.viewport.x + constants.WIDTH / 2 - 20,
    CTDLGAME.viewport.y + constants.HEIGHT / 3,
    41, 21
  );

  if (newGameButton.active) {
    write(
      constants.menuContext,
      CTDLGAME.frame % (constants.FRAMERATE * 8) >= constants.FRAMERATE * 4 ? '~ new game' : 'new game',
      {
        x: CTDLGAME.viewport.x + newGameButton.x - 10,
        y: CTDLGAME.viewport.y + newGameButton.y,
        w: newGameButton.w
      },
      'right'
    );
  }

  if (!CTDLGAME.newGame && loadGameButton.active) {
    write(
      constants.menuContext,
      CTDLGAME.frame % (constants.FRAMERATE * 8) >= constants.FRAMERATE * 4 ? '~ resume game' : 'resume game',
      {
        x: CTDLGAME.viewport.x + loadGameButton.x - 10,
        y: CTDLGAME.viewport.y + loadGameButton.y,
        w: loadGameButton.w
      },
      'right'
    );
  }
};