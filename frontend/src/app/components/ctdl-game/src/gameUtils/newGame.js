import { CTDLGAME } from './CTDLGAME';
import Character from '../Character';
import { changeMap } from '../mapUtils';
import { setTextQueue } from '../textUtils';
import { getEmptyInventory } from './getEmptyInventory';
import { saveButton } from '../events';

/**
 * @description Method to prepare new game
 * @returns {void}
 */
export const newGame = async () => {
  CTDLGAME.frame = 0;

  CTDLGAME.inventory = getEmptyInventory();
  CTDLGAME.blockHeight = -1; // set blockHeight to -1 to enable fetching genesis block
  setTextQueue([]);

  CTDLGAME.hodlonaut = new Character(
    'hodlonaut',
    {}
  );
  CTDLGAME.katoshi = new Character(
    'katoshi',
    {
      active: false,
      direction: 'left'
    }
  );

  CTDLGAME.startedNewGame = true;
  saveButton.active = true;
  CTDLGAME.hodlonaut.choose();

  CTDLGAME.objects = [];

  CTDLGAME.objects.push(CTDLGAME.hodlonaut);
  CTDLGAME.objects.push(CTDLGAME.katoshi);

  CTDLGAME.gameOver = false;
  CTDLGAME.wizardCountdown = 64;

  await changeMap('mempool', 'rabbitHole');

  CTDLGAME.objects.forEach(obj => CTDLGAME.quadTree.insert(obj));
  CTDLGAME.objects.forEach(obj => obj.update());

  CTDLGAME.frame = 6096 + 250;
};