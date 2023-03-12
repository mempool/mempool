import { CTDLGAME } from './CTDLGAME';

/**
 * @description Method to switch between day and night
 * @returns {void}
 */
export const circadianRhythm = time => {
  if (time >= 5 && time < 18) {
    CTDLGAME.isNight = false;
  } else {
    CTDLGAME.isNight = true;
  }
};