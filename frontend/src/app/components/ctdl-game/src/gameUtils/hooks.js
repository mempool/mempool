import { CTDLGAME } from './CTDLGAME';

let hooks = [];

/**
 * @description Method to add hook to queue
 * @param {Number} frame the frame to execute this hook
 * @param {Function} hook the hook
 */
export const addHook = (frame, hook) => hooks.push({frame, hook});

/**
 * @description Method to execute hooks in queue
 */
export const executeHooks = () => {
  hooks
    .filter(({frame}) => frame <= CTDLGAME.frame)
    .map(({hook}) => hook());
  hooks = hooks.filter(({frame}) => frame > CTDLGAME.frame);
};