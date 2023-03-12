import constants from '../constants';
import { textQueue } from './textQueue';
import { CTDLGAME } from '../gameUtils';

const timeToShowFinishedText = 256;

/**
 * @description Method to add text to queue for showing in the text box
 * @param {String} text text to be queued
 * @param {Function} callback callback to execute when text is written
 * @param {Boolean} cutScene if true show as overlay
 */
export const addTextToQueue = (text, callback, cutScene) => {
  text += ' ▾';
  const lastText = textQueue[textQueue.length - 1];
  let lastFrame = lastText ? lastText.text.length + lastText.frame + timeToShowFinishedText : CTDLGAME.frame;
  if (CTDLGAME.frame + lastFrame > constants.FRAMERESET) lastFrame = CTDLGAME.frame - constants.FRAMERESET + lastFrame;
  textQueue.push({
    text,
    frame: lastFrame,
    callback,
    cutScene
  });
};