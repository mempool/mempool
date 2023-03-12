import constants from '../constants';
import { write } from '../font';
import { textQueue } from './textQueue';
import { CTDLGAME } from '../gameUtils';
import { skipCutSceneButton } from '../events';
import { canDrawOn } from '../performanceUtils';

const timeToShowFinishedText = 256;

/**
 * @description Method to write text from queue to the textbox
 * @returns {void}
 */
export const writeMenu = () => {
  if (!canDrawOn('menuContext')) return; // do net render on menu yet
  if (textQueue.length === 0) return;
  const next = textQueue[0];

  // if text is used up, remove it from queue
  if (next.text.length + next.frame + timeToShowFinishedText - CTDLGAME.frame < 0) textQueue.shift();
  if (textQueue.length === 0) return;

  const text = textQueue[0];
  if (text.callback && text.text.length + text.frame + timeToShowFinishedText - CTDLGAME.frame < 8) {
    text.callback();
  }

  if (text.cutScene) {
    constants.menuContext.fillStyle = '#212121';
    constants.menuContext.fillRect(
      CTDLGAME.viewport.x,
      CTDLGAME.viewport.y,
      constants.WIDTH,
      constants.HEIGHT
    );
    write(
      constants.menuContext,
      text.text, {
        x: CTDLGAME.viewport.x + constants.TEXTBOX.x,
        y: CTDLGAME.viewport.y + Math.round(constants.HEIGHT / 3),
        w: constants.TEXTBOX.w
      },
      'left',
      false,
      CTDLGAME.frame - text.frame
    );
    write(
      constants.menuContext,
      'skip', {
        x: CTDLGAME.viewport.x + constants.WIDTH / 2 - 9,
        y: CTDLGAME.viewport.y + constants.HEIGHT - 60,
        w: 60
      },
      'right'
    );

    return;
  }

  constants.menuContext.globalAlpha = CTDLGAME.lockCharacters ? 1 : .7;
  constants.menuContext.fillStyle = '#212121';
  constants.menuContext.fillRect(
    CTDLGAME.viewport.x + constants.TEXTBOX.x,
    CTDLGAME.viewport.y + constants.TEXTBOX.y,
    constants.TEXTBOX.w,
    constants.MENU.h
  );
  constants.menuContext.globalAlpha = 1;

  write(
    constants.menuContext,
    text.text, {
      x: CTDLGAME.viewport.x + constants.TEXTBOX.x,
      y: CTDLGAME.viewport.y + constants.TEXTBOX.y,
      w: constants.TEXTBOX.w
    },
    'left',
    false,
    CTDLGAME.frame - text.frame
  );

  if (constants.BUTTONS.find(btn => btn.action === 'skipCutScene').active) {
    write(
      constants.menuContext,
      'skip', {
        x: CTDLGAME.viewport.x + skipCutSceneButton.x,
        y: CTDLGAME.viewport.y + skipCutSceneButton.y,
        w: skipCutSceneButton.w
      },
      'right',
      false
    );
  }
};