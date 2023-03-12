import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { showInventory } from './showInventory';
import { showHealth } from './showHealth';
import { showSettings } from './showSettings';
import { showControls } from './showControls';
import { canDrawOn } from '../performanceUtils';

/**
 * @description Method to render game menu
 * @param {Object} inventory inventory object
 * @returns {void}
 */
export const showMenu = inventory => {
  if (canDrawOn('menuContext')) {
    constants.menuContext.fillStyle = '#212121';
    constants.menuContext.fillRect(
      CTDLGAME.viewport.x,
      CTDLGAME.viewport.y + constants.HEIGHT - constants.MENU.h,
      constants.MENU.w,
      constants.MENU.h
    );
  }

  showInventory(inventory);
  showHealth();
  showSettings();
  if (CTDLGAME.touchScreen) showControls();
};