import * as db from '../db';
import { CTDLGAME, setWorld } from './CTDLGAME';
import World from '../World';
import Character from '../Character';
import { getTimeOfDay } from './getTimeOfDay';
import { initSoundtrack } from '../soundtrack';
import { updateViewport } from './updateViewport';
import { gameObjects } from './gameObjects';
import { loadMap } from '../mapUtils';
import { saveButton } from '../events';

/**
 * @description Method to load game
 * @returns {void}
 */
export const loadGame = async () => {
  const time = await db.get('time');
  const worldId = await db.get('worldId');

  const hodlonaut = await db.get('hodlonaut');
  const katoshi = await db.get('katoshi');
  const objects = await db.get(`objects-${worldId}`);
  const worldState = await db.get(`worldState-${worldId}`);
  const blockHeight = await db.get('blockHeight');
  const inventory = await db.get('inventory');
  const options = await db.get('options');

  if (time) CTDLGAME.frame = time;

  if (objects) {
    CTDLGAME.objects = objects
      .filter(obj => gameObjects[obj.class])
      .map(obj => new gameObjects[obj.class](obj.id, obj));
  }

  setWorld(new World(worldId, await loadMap(worldId)));

  if (CTDLGAME.objects.length === 0) {
    // we have no objects, let's get them from the world map
    CTDLGAME.objects = CTDLGAME.world.map.objects;
  } else {
    // we already have objects, only get tiles and ramps
    CTDLGAME.world.map.objects
    .filter(obj => /Tile|Ramp|Boundary/.test(obj.getClass()))
    .map(obj => CTDLGAME.objects.push(obj));
  }
  if (worldState) CTDLGAME.world.map.state = worldState;

  if (blockHeight) CTDLGAME.blockHeight = blockHeight;
  if (inventory) CTDLGAME.inventory = inventory;
  if (options) CTDLGAME.options = options;

  CTDLGAME.gameOver = false;
  saveButton.active = true;

  CTDLGAME.hodlonaut = new Character(
    'hodlonaut',
    hodlonaut
  );
  CTDLGAME.katoshi = new Character(
    'katoshi',
    katoshi
  );

  if (CTDLGAME.world.map.init) CTDLGAME.world.map.init();

  if (CTDLGAME.hodlonaut.selected) window.SELECTEDCHARACTER = CTDLGAME.hodlonaut;
  if (CTDLGAME.katoshi.selected) window.SELECTEDCHARACTER = CTDLGAME.katoshi;

  updateViewport();

  CTDLGAME.objects.push(CTDLGAME.hodlonaut);
  CTDLGAME.objects.push(CTDLGAME.katoshi);

  CTDLGAME.objects.forEach(obj => {
    CTDLGAME.quadTree.insert(obj);
  });

  const timeOfDay = getTimeOfDay();
  if (timeOfDay > 18.5) {
    CTDLGAME.isNight = true;
  } else if (timeOfDay > 5.5) {
    CTDLGAME.isNight = false;
  }

  initSoundtrack(CTDLGAME.world.map.track());
};