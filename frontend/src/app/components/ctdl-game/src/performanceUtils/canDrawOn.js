import constants from '../constants';
import { CTDLGAME } from '../gameUtils';

/**
 * @description Method to determine if frame rate of context is hit
 * @param {String} context the context to check
 * @returns {Boolean} true if context can be drawn on
 */
export const canDrawOn = context => {
    return CTDLGAME.frame % constants.FRAMERATES[context] === 0;
};

export default canDrawOn;