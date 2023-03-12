import constants from '../constants';
import { textQueue, setTextQueue } from './textQueue';
import { CTDLGAME } from '../gameUtils';

const timeToShowFinishedText = 256;

/**
 * @description Method to skip text in queue
 * @returns {void}
 */
export const skipText = () => {
  const currentText = textQueue[0];
  if (currentText) {
    if (CTDLGAME.frame - currentText.text.length > currentText.frame) {
      const deletedText = textQueue.shift();
      if (deletedText.callback) deletedText.callback();
      if (textQueue[0]) textQueue[0].frame = CTDLGAME.frame;
    } else {
      currentText.frame = CTDLGAME.frame - currentText.text.length;
    }
    setTextQueue(textQueue.map((text, i) => {
      if (i === 0) return text;
      const lastText = textQueue[i - 1];
      let lastFrame = lastText ? lastText.text.length + lastText.frame + timeToShowFinishedText : CTDLGAME.frame;
      if (CTDLGAME.frame + lastFrame > constants.FRAMERESET) lastFrame = CTDLGAME.frame - constants.FRAMERESET + lastFrame;
      text.frame = lastFrame;
      return text;
    }));
  }
};