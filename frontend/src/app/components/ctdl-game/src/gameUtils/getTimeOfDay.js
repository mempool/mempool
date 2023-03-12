import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';

/**
 * @description Method to get current time of the day based on the frame in the game
 * @returns {Number} time between 0 - 24 hours
 */
export const getTimeOfDay = () => {
  let time = (CTDLGAME.frame % constants.FRAMESINADAY) / constants.FRAMESINADAY * 24 + 6;
  if (time > 24) time -= 24;
  return time;
};