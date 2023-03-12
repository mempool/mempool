export let textQueue = [];

/**
 * @description Method to overwritte current text queue
 * @param {Object[]} newTextQueue 
 * @returns {void}
 */
export const setTextQueue = newTextQueue => {
    textQueue = newTextQueue;
};