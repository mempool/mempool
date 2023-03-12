import * as db from '../db';

/**
 * @description Method to check if a saved game exists
 * @returns {Boolean} true if saved game exists
 */
export const saveStateExists = async () => {
  const time = await db.get('time');

  if (!time) return false; // check if time could be loaded before proceeding

  return true;
};