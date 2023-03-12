import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { drawIcon } from '../icons';
import { musicButton, soundButton } from '../events';
import { canDrawOn } from '../performanceUtils';
import { showSaveIcon } from './showSaveIcon';

/**
 * @description Method to render in game settings (music, sound)
 * @returns {void}
 */
export const showSettings = () => {
  if (!canDrawOn('menuContext')) return; // do net render on menu yet

  const posMusic = {
    x: musicButton.x + CTDLGAME.viewport.x,
    y: musicButton.y + CTDLGAME.viewport.y
  };
  const posSound = {
    x: soundButton.x + CTDLGAME.viewport.x,
    y: soundButton.y + CTDLGAME.viewport.y
  };

  constants.menuContext.strokeStyle = '#FFF';
  constants.menuContext.fillStyle = '#FFF';
  constants.menuContext.lineWidth = 1;

  constants.menuContext.beginPath();

  if (CTDLGAME.world) showSaveIcon(1);

  drawIcon(constants.menuContext, 'music', {
    x: posMusic.x,
    y: posMusic.y,
    opacity: CTDLGAME.options.music ? 1 : .5
  });
  drawIcon(constants.menuContext, 'sound', {
    x: posSound.x,
    y: posSound.y,
    opacity: CTDLGAME.options.sound ? 1 : .5
  });
};