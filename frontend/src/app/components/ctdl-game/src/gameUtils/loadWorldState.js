import * as db from '../db';

/**
 * @description Method to load world
 * @returns {Promise} promise resolving to world objects in array
 */
export const loadWorldState = async worldId => await db.get(`worldState-${worldId}`);