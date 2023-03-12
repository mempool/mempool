import { CTDLGAME } from './CTDLGAME';

/**
 * @description Method to clean up stage from "expired objects"
 * @returns {void}
 */
export const cleanUpStage = () => {
  CTDLGAME.objects = CTDLGAME.objects
    .filter(obj => {
      // remove objects that have obviously fallen into the abyss except bosses
      return obj.boss || obj.y < CTDLGAME.world.h * 2;
    })
    .filter(obj => obj && !obj.remove && obj.y < 2048); // remove objects that are marked for removal

  if (!CTDLGAME.isNight) {
    CTDLGAME.objects = CTDLGAME.objects.filter(obj => {
      if (obj.class !== 'Shitcoiner') return true;
      if (obj.status !== 'rekt' && obj.status !== 'burning') return true;
      if (obj.status === 'burning' && Math.random() < .25) {
        return false;
      }

      obj.status = 'burning';
      return true;
    });
  }
};