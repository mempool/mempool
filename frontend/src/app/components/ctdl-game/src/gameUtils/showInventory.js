import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { write } from '../font';
import { toCurrency } from '../stringUtils';
import { canDrawOn } from '../performanceUtils';

const backpack = {
  x: constants.WIDTH / 2 - 10,
  y: constants.HEIGHT - constants.MENU.h + 2,
  w: 22,
  h: 22
};

/**
 * @description Method to show current inventory
 * @param {Object} inventory inventory object
 * @param {Object[]} inventory.blocks found blocks
 * @param {Number} inventory.sats Bitcoin balance in sats
 * @param {Number} inventory.usd USD Balance
 */
export const showInventory = inventory => {
  if (!canDrawOn('menuContext')) return;

  const pos = {
    x: backpack.x + CTDLGAME.viewport.x,
    y: backpack.y + CTDLGAME.viewport.y
  };

  constants.menuContext.fillStyle = '#FFF';
  constants.menuContext.strokeStyle = '#FFF';
  constants.menuContext.lineWidth = 1;

  constants.menuContext.beginPath();
  constants.menuContext.rect(
    pos.x - .5,
    pos.y - .5,
    backpack.w,
    backpack.h
  );
  constants.menuContext.stroke();

  constants.menuContext.drawImage(
    CTDLGAME.assets.inventoryBlock,
    0, 0, 16, 16,
    pos.x + (backpack.w - 16) / 2, pos.y + (backpack.h - 16) / 2, 16, 16
  );

  write(
    constants.menuContext,
    'ˣ' + inventory.blocks.length, {
      x: pos.x,
      y: pos.y + backpack.h - 11,
      w: backpack.w - 3
    },
    'right',
    true
  );

  write(
    constants.menuContext,
    toCurrency(inventory.sats, 'BTC') + '\n' + toCurrency(inventory.usd, 'USD'), {
      x: CTDLGAME.viewport.x + 2,
      y: pos.y + 1,
      w: 40
    },
    'left',
    false
  );
};