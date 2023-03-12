import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { write } from '../font';
import { canDrawOn } from '../performanceUtils';

/**
 * @description Method to display progress bar
 * @returns {void}
 */
export const showStartGameScreen = () => {
  if (!canDrawOn('menuContext')) return;

  constants.menuContext.fillStyle = '#212121';

  constants.menuContext.fillRect(
    CTDLGAME.viewport.x,
    CTDLGAME.viewport.y,
    constants.WIDTH,
    constants.HEIGHT
  );

  const text = CTDLGAME.frame / constants.FRAMERATE > constants.FRAMERATE ? '$ bitcoind -daemon' : '$ bitcoind -daemon|';
  write(
    constants.menuContext,
    text, {
      x: CTDLGAME.viewport.x + constants.WIDTH / 2 - 40,
      y: CTDLGAME.viewport.y + constants.HEIGHT / 2,
      w: constants.WIDTH - 40
    },
    'left'
  );
  write(
    constants.menuContext,
    'click to start', {
      x: CTDLGAME.viewport.x + constants.WIDTH / 2 - 29,
      y: CTDLGAME.viewport.y + constants.HEIGHT / 2 + 20,
      w: constants.WIDTH - 40
    },
    'left'
  );
};