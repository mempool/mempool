import { CTDLGAME } from './CTDLGAME';
import { addTextToQueue } from '../textUtils';
import { newGame } from './newGame';
import { stopMusic } from '../soundtrack';

/**
 * @description Method to prepare new game
 */
export const showIntro = () => {
  addTextToQueue([
    'Welcome to the\nmempool-spa experience!',
    'The water is\ncomfortably hot.',
    'The mood\'s great down here.',
    'Enjoy your stay!'
  ].join('\n'), () => {
    stopMusic();
    newGame();
    CTDLGAME.cutScene = false;
  }, true);
};