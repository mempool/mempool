import constants from '../constants';
import Block from '../Block';
import { CTDLGAME } from '../gameUtils';
import { touches, intersects, sharpLine } from '../geometryUtils';

/**
 * @description Method to render overlay layer, typically to display block placement and zoom
 */
export const showOverlay = () => {
  constants.overlayContext.clearRect(CTDLGAME.viewport.x, CTDLGAME.viewport.y, constants.WIDTH, constants.HEIGHT);

  if (Math.abs(window.SELECTEDCHARACTER.getCenter().x - (CTDLGAME.viewport.x + CTDLGAME.cursor.x)) > 30) return;
  if (Math.abs(window.SELECTEDCHARACTER.getCenter().y - (CTDLGAME.viewport.y + CTDLGAME.cursor.y)) > 30) return;

  if (CTDLGAME.inventory.blocks.length > 0 && CTDLGAME.world.map.canSetBlocks) {
    const block = CTDLGAME.inventory.blocks[0];
    CTDLGAME.ghostBlock = new Block(
      block.id,
      {
        x: Math.round((CTDLGAME.viewport.x + CTDLGAME.cursor.x) / 3) * 3 - 3,
        y: Math.round((CTDLGAME.viewport.y + CTDLGAME.cursor.y) / 3) * 3 - 3,
        w: 6,
        h: 6,
        context: 'overlayContext',
        opacity: .5,
        info: {
          height: block.height
        }
      },
      block
    );
    const touchingObject = CTDLGAME.quadTree.query(CTDLGAME.ghostBlock)
      .find(obj =>
        touches(CTDLGAME.ghostBlock, obj.getBoundingBox()) &&
        obj.getClass() !== 'Character'
      );
    if (CTDLGAME.ghostBlock.y > CTDLGAME.world.h - constants.MENU.h) CTDLGAME.ghostBlock.status = 'bad';

    const intersectingObject = CTDLGAME.quadTree.query(CTDLGAME.ghostBlock)
      .find(obj => intersects(CTDLGAME.ghostBlock, obj.getBoundingBox()));

    if (!touchingObject) CTDLGAME.ghostBlock.status = 'bad';
    if (intersectingObject?.getClass() === 'Block') {
      CTDLGAME.ghostBlock = null;
    } else {
      constants.overlayContext.fillStyle = '#FFF';
      sharpLine(
        constants.overlayContext,
        Math.round(CTDLGAME.ghostBlock.getCenter().x),
        Math.round(CTDLGAME.ghostBlock.getCenter().y),
        Math.round(window.SELECTEDCHARACTER.getCenter().x),
        Math.round(window.SELECTEDCHARACTER.getCenter().y)
      );
      CTDLGAME.ghostBlock.update();
    }
  }
};