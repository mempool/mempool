import constants from '../constants';
import { write } from '../font';
import { CTDLGAME } from '../gameUtils';
import { yesButton, nahButton } from '../events';

/**
 * @description Method to write text from queue to the textbox
 * @returns {void}
 */
export const prompt = ({ text, payload, ok, cancel }) => {
  CTDLGAME.lockCharacters = true;

  constants.menuContext.globalAlpha = 1;
  constants.menuContext.fillStyle = '#212121';
  constants.menuContext.fillRect(
    CTDLGAME.viewport.x + constants.MENU.x,
    CTDLGAME.viewport.y + constants.MENU.y,
    constants.MENU.w,
    constants.MENU.h
  );
  constants.menuContext.globalAlpha = 1;

  write(
    constants.menuContext,
    text, {
      x: CTDLGAME.viewport.x + constants.MENU.x,
      y: CTDLGAME.viewport.y + constants.MENU.y,
      w: constants.MENU.w
    },
    'left',
    false
  );

  yesButton.active = true;
  nahButton.active = true;

  yesButton.onclick = () => {
    ok(payload);
    CTDLGAME.lockCharacters = false;
    CTDLGAME.prompt = null;
    yesButton.disable();
  };
  nahButton.onclick = () => {
    cancel(payload);
    CTDLGAME.lockCharacters = false;
    CTDLGAME.prompt = null;
    nahButton.disable();
  };

  write(
    constants.menuContext,
    'yes', {
      x: CTDLGAME.viewport.x + yesButton.x,
      y: CTDLGAME.viewport.y + yesButton.y,
      w: yesButton.w
    },
    'left',
    false
  );
  write(
    constants.menuContext,
    'nah', {
      x: CTDLGAME.viewport.x + nahButton.x,
      y: CTDLGAME.viewport.y + nahButton.y,
      w: nahButton.w
    },
    'right',
    false
  );
};