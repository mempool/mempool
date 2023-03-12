import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { drawIcon } from '../icons';
import { canDrawOn } from '../performanceUtils';
import { write } from '../font';
import { saveButton } from '../events';

/**
 * @description Method to show save icon
 * @param {Number} opacity opacity value
 */
export const showSaveIcon = opacity => {
  if (!saveButton.active) return;
  if (!canDrawOn('menuContext')) return;

  drawIcon(
    constants.menuContext,
    'save', {
      x: CTDLGAME.viewport.x + 3,
      y: CTDLGAME.viewport.y + 3,
      opacity
    }
  );

  if (CTDLGAME.savedAt && CTDLGAME.frame - CTDLGAME.savedAt < 128) {
    const opacity = (128 - (CTDLGAME.frame - CTDLGAME.savedAt)) / 128;
    constants.menuContext.globalAlpha = opacity;
    write(
      constants.menuContext,
      'saved', {
        x: CTDLGAME.viewport.x + 12,
        y: CTDLGAME.viewport.y + 1,
        w: 60
      },
      'left',
      false,
    );
    constants.menuContext.globalAlpha = 1;
  }
};