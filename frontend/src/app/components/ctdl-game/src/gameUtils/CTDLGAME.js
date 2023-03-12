import constants from '../constants';
import { QuadTree, Boundary } from '../Quadtree';
import { assets } from './assets';

export const CTDLGAME = {
  cursor: {x: 0, y: 0},
  frame: 0,
  assets,
  startScreen: true,
  touchScreen: true,
  options: {
    music: true,
    sound: true
  },
  viewport: constants.START,
  objects: [],
  eventButtons: [],
  blockHeight: -1,
  inventory: {
    usd: 0,
    sats: 0,
    blocks: []
  }
};

export const getAssets = () => CTDLGAME.assets;

export const setWorld = world => {
  CTDLGAME.world = world;
  CTDLGAME.quadTree = new QuadTree(new Boundary({
    x: -16.04137, // use odd number to avoid tiles lining up on half lines
    y: -16.04137,
    w: world.w + 32.08274,
    h: world.h + 32.08274
  }));
};