import { CTDLGAME, setWorld } from '../gameUtils/CTDLGAME';
import { loadWorldObjects, saveGame, updateViewport, gameObjects, loadWorldState } from '../gameUtils';
import World from '../World';
import { initSoundtrack } from '../soundtrack';
import { loadMap } from './loadMap';

/**
 * @description Method to fascilitate changing of maps
 * @param {String} id world id
 * @param {String} from world id
 * @returns {void}
 */
export const changeMap = async (id, from) => {
  if (CTDLGAME.world && !CTDLGAME.world.ready) return;
  // save state before changing

  if (from !== 'newGame') await saveGame(true);

  // remove all objects but characters
  CTDLGAME.objects = CTDLGAME.objects.filter(obj => obj.getClass() === 'Character');

  // create new world
  const newWorld = new World(id, await loadMap(id));
  const objects = from !== 'newGame' ? await loadWorldObjects(id) : null;
  const worldState = from !== 'newGame' ? await loadWorldState(id) : null;

  // Save state of old world

  if (CTDLGAME.world) CTDLGAME.world.ready = false;
  setWorld(newWorld);

  if (worldState) CTDLGAME.world.map.state = worldState;

  if (objects && objects.length > 0) {
    // we have saved objects, let's initialize them
    objects
      .filter(obj => gameObjects[obj.class])
      .map(obj => new gameObjects[obj.class](obj.id, obj))
      .map(obj => CTDLGAME.objects.push(obj));
  } else {
    // we have no objects saved, let's get the default ones
    CTDLGAME.world.map.npcs().map(obj => CTDLGAME.objects.push(obj));
    CTDLGAME.world.map.items().map(obj => CTDLGAME.objects.push(obj));
  }

  CTDLGAME.world.map.objects
    .filter(obj => /Tile|Ramp|Boundary/.test(obj.getClass()))
    .map(obj => CTDLGAME.objects.push(obj));

  // prevent object falling into the floor
  CTDLGAME.objects
    .filter(obj => obj.applyGravity)
    .map(obj => obj.vy = -2);

  if (CTDLGAME.hodlonaut.health > 0) {
    CTDLGAME.hodlonaut.x = newWorld.map.start[from].x - 3;
    CTDLGAME.hodlonaut.y = newWorld.map.start[from].y;
    CTDLGAME.hodlonaut.protection = 24;
  }
  if (CTDLGAME.katoshi.health > 0) {
    CTDLGAME.katoshi.x = newWorld.map.start[from].x + 3;
    CTDLGAME.katoshi.y = newWorld.map.start[from].y;
    CTDLGAME.katoshi.protection = 24;
  }
  if (!CTDLGAME.bitcoinLabrador) {
    CTDLGAME.bitcoinLabrador = CTDLGAME.objects.find(obj => obj.id === 'bitcoinLabrador');
  }
  if (CTDLGAME.bitcoinLabrador && CTDLGAME.bitcoinLabrador.follow) {
    CTDLGAME.bitcoinLabrador.x = newWorld.map.start[from].x;
    CTDLGAME.bitcoinLabrador.y = newWorld.map.start[from].y;
    CTDLGAME.objects.push(CTDLGAME.bitcoinLabrador);
  }
  if (!CTDLGAME.nakadaiMon) {
    CTDLGAME.nakadaiMon = CTDLGAME.objects.find(obj => obj.id === 'nakadai_mon');
  }
  if (CTDLGAME.nakadaiMon && CTDLGAME.nakadaiMon.follow) {
    CTDLGAME.nakadaiMon.x = newWorld.map.start[from].x;
    CTDLGAME.nakadaiMon.y = newWorld.map.start[from].y;
    CTDLGAME.objects.push(CTDLGAME.nakadaiMon);
  }

  if (CTDLGAME.world.map.init) CTDLGAME.world.map.init(from);
  updateViewport();

  initSoundtrack(newWorld.map.track());
  // save again the new map
  if (from !== 'newGame') await saveGame();
};

export default changeMap;