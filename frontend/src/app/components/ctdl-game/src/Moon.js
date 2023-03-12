import constants from './constants';
import { CTDLGAME, getTimeOfDay } from './gameUtils';
import GameObject from './GameObject';
import { canDrawOn } from './performanceUtils';

class Moon extends GameObject {
  constructor(options) {
    super('moon', options);
    this.spriteData = { x: 0, y: 0, w: 109, h: 109 };
    this.isSolid = false;
  }

  w = 109;
  h = 109;

  update = () => {
    if (!canDrawOn('skyContext')) return;

    const timeOfDay = getTimeOfDay();
    this.y = Math.round(CTDLGAME.viewport.y + 10);
    this.w = this.h = Math.max(14, (1 - (CTDLGAME.viewport.y + constants.HEIGHT) / CTDLGAME.world.h) * 110);

    if (timeOfDay >= 6 && timeOfDay < 18) return;
    if (timeOfDay >= 18 && timeOfDay < 19) {
      this.y += (19 - timeOfDay) * constants.HEIGHT;
    }
    if (timeOfDay > 5 && timeOfDay < 6) {
      this.y += (timeOfDay - 5) * constants.HEIGHT;
    }

    this.x = Math.round(CTDLGAME.viewport.x + constants.WIDTH / 2);
    const sprite = CTDLGAME.assets.moon;
    constants.skyContext.drawImage(
      sprite,
      this.spriteData.x, this.spriteData.y, this.spriteData.w, this.spriteData.h,
      Math.round(this.x - this.w / 2), Math.round(this.y - this.h / 2), this.w, this.h
    );
  };
}
export default Moon;