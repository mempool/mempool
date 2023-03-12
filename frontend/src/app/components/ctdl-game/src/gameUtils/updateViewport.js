import constants from '../constants';
import { intersects } from '../geometryUtils';
import { CTDLGAME } from './CTDLGAME';

/**
 * @description Method to find out if character is eligible for teleporting
 * @param {Character} character character
 * @returns {Boolean} true if character is eligible for teleporting
 */
const canTeleport = character => character.status !== 'rekt' && character.follow && !intersects(character, CTDLGAME.viewport);

/**
 * @description Method to translate canvas to show current viewport based on where the characters are
 * @returns {void}
 */
export const updateViewport = () => {
  if (CTDLGAME.focusViewport) {
    CTDLGAME.viewport.x = Math.round(CTDLGAME.focusViewport.x + CTDLGAME.focusViewport.w / 2 - constants.WIDTH / 2);
    CTDLGAME.viewport.y = Math.min(CTDLGAME.world.h, Math.round(CTDLGAME.focusViewport.y + CTDLGAME.focusViewport.h - constants.HEIGHT / 2));
  } else if (CTDLGAME.multiPlayer) {
    CTDLGAME.viewport.x = Math.round((CTDLGAME.hodlonaut.x + CTDLGAME.katoshi.x) / 2 - constants.WIDTH / 2);
    CTDLGAME.viewport.y = Math.min(CTDLGAME.world.h, Math.round((CTDLGAME.hodlonaut.y + CTDLGAME.katoshi.y) / 2));
  } else {
    CTDLGAME.viewport.x = Math.round(window.SELECTEDCHARACTER.x + window.SELECTEDCHARACTER.w / 2 - constants.WIDTH / 2);
    CTDLGAME.viewport.y = Math.min(CTDLGAME.world.h, Math.round(window.SELECTEDCHARACTER.y + window.SELECTEDCHARACTER.h - constants.HEIGHT / 2));
  }

  if (CTDLGAME.hodlonaut.selected && canTeleport(CTDLGAME.katoshi)) {
    CTDLGAME.katoshi.x = CTDLGAME.hodlonaut.x;
    CTDLGAME.katoshi.y = CTDLGAME.hodlonaut.y;
    CTDLGAME.katoshi.protection = 16;
  }
  if (CTDLGAME.katoshi.selected && canTeleport(CTDLGAME.hodlonaut)) {
    CTDLGAME.hodlonaut.x = CTDLGAME.katoshi.x;
    CTDLGAME.hodlonaut.y = CTDLGAME.katoshi.y;
    CTDLGAME.hodlonaut.protection = 16;
  }
  if (CTDLGAME.bitcoinLabrador && canTeleport(CTDLGAME.bitcoinLabrador)) {
    CTDLGAME.bitcoinLabrador.x = window.SELECTEDCHARACTER.x;
    CTDLGAME.bitcoinLabrador.y = window.SELECTEDCHARACTER.y;
  }
  if (CTDLGAME.nakadaiMon && canTeleport(CTDLGAME.nakadaiMon)) {
    CTDLGAME.nakadaiMon.x = window.SELECTEDCHARACTER.x;
    CTDLGAME.nakadaiMon.y = window.SELECTEDCHARACTER.y;
  }

  CTDLGAME.viewport.x = Math.max(0, CTDLGAME.viewport.x);
  CTDLGAME.viewport.x = Math.min(CTDLGAME.world.w - constants.WIDTH, CTDLGAME.viewport.x);
  CTDLGAME.viewport.y = Math.max(0, CTDLGAME.viewport.y);
  CTDLGAME.viewport.y = Math.min(CTDLGAME.world.h - constants.HEIGHT + constants.MENU.h, CTDLGAME.viewport.y);

  constants.parallaxContext.setTransform(1, 0, 0, 1, -Math.round(CTDLGAME.viewport.x / 2), -Math.round(CTDLGAME.viewport.y / 4 + CTDLGAME.world.h / 4 * 3 - 144))

  ;[
    constants.skyContext,
    constants.bgContext,
    constants.gameContext,
    constants.fgContext,
    constants.charContext,
    constants.overlayContext,
    constants.menuContext
  ].map(context => {
    context.setTransform(1, 0, 0, 1, -CTDLGAME.viewport.x, -CTDLGAME.viewport.y);
  });

  const extendedViewport = {
    x: CTDLGAME.viewport.x - 16,
    y: CTDLGAME.viewport.y - 128,
    w: CTDLGAME.viewport.w + 32,
    h: CTDLGAME.viewport.h + 256
  };
  const extraExtendedViewport = {
    x: CTDLGAME.viewport.x - 32,
    y: CTDLGAME.viewport.y - 144,
    w: CTDLGAME.viewport.w + 64,
    h: CTDLGAME.viewport.h + 288
  };
  CTDLGAME.objects
    .map(obj => {
      if (obj.boss && obj.hadIntro) {
        obj.inViewport = true;
        return obj;
      }

      if (/Boundary|Ramp/.test(obj.getClass())) {
        obj.inViewport = intersects(extraExtendedViewport, obj.getBoundingBox('whole'));
      } else {
        obj.inViewport = intersects(extendedViewport, obj.getBoundingBox('whole'));
      }
      return obj;
    });
};