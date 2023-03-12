import * as db from '../db';
import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { initSoundtrack, stopMusic, changeVolume } from '../soundtrack';
import { loadGameButton, newGameButton, saveButton } from '../events';
import { setTextQueue } from '../textUtils';

let deathCounter = 64;
/**
 * @description Method to fade into game over screen
 * @returns {void}
 */
export const fadeIntoGameOver = () => {
  deathCounter--;

  changeVolume(deathCounter / 64);

  constants.overlayContext.fillStyle = '#212121';
  constants.overlayContext.globalAlpha = (64 - deathCounter) / 64;
  constants.overlayContext.fillRect(
    CTDLGAME.viewport.x,
    CTDLGAME.viewport.y,
    constants.WIDTH,
    constants.HEIGHT
  );
  saveButton.active = false;

  if (deathCounter === 0) {
    CTDLGAME.gameOver = true;

    if (CTDLGAME.options.difficulty === 'rogue') db.destroy();

    newGameButton.active = true;
    loadGameButton.active = true;

    stopMusic();
    changeVolume(1);
    initSoundtrack('gameOver');
    setTextQueue([]);

    constants.BUTTONS.find(button => button.action === 'newGame').active = true;
  }
};