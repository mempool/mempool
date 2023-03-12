import constants from './constants';
import { CTDLGAME, getTimeOfDay } from './gameUtils';
import GameObject from './GameObject';
import { easeInOut } from './geometryUtils';
import { canDrawOn } from './performanceUtils';

class Sun extends GameObject {
  constructor(options) {
    super('sun', options);
    this.class = 'Sun';
    this.isSolid = false;
  }

  w = 7;
  h = 7;

  drawSky = timeOfDay => {
    let y = timeOfDay < 4 || timeOfDay > 20 ? 0 : 1;

    if (timeOfDay >= 4 && timeOfDay <= 6) {
      y = easeInOut((timeOfDay - 4) / 2, 3);
    } else if (timeOfDay >= 17 && timeOfDay <= 20) {
      y = easeInOut((timeOfDay - 20) / -3, 3);
    }

    const sky = {
      h: Math.max(245, Math.min(338, 338 - y * 93)),
      s: Math.max(11, Math.min(50, 50 - y * 39)),
      l: Math.min(78, Math.max(3, 3 + y * 75))
    };
    CTDLGAME.skyColor = sky;

    constants.skyContext.fillStyle = `hsl(${sky.h}, ${sky.s}%, ${sky.l}%)`;
    constants.skyContext.fillRect(CTDLGAME.viewport.x, CTDLGAME.viewport.y, constants.WIDTH, constants.HEIGHT);
  };

  update = () => {
    if (!canDrawOn('skyContext')) return;

    const timeOfDay = getTimeOfDay();
    // first column, is day time, second is night time
    this.y = Math.round(CTDLGAME.viewport.y + 10);
    
    this.drawSky(timeOfDay);

    if (timeOfDay < 5 || timeOfDay > 19) return;
    if (timeOfDay < 6) {
      this.y += (5 - timeOfDay + 1) * constants.HEIGHT;
    }

    if (timeOfDay > 18) {
      this.y += (timeOfDay - 18) * constants.HEIGHT;
    }

    const middle = CTDLGAME.viewport.x + constants.WIDTH / 2;
    this.x = Math.round(middle - (CTDLGAME.viewport.x * 8 / CTDLGAME.world.w));
    const center = this.getCenter();

    constants.skyContext.fillStyle = '#FFF';
    constants.skyContext.beginPath();
    constants.skyContext.arc(center.x, center.y, this.w, 0, 2 * Math.PI);
    constants.skyContext.fill();
  };

  getCenter = () => ({
    x: this.x,
    y: this.y
  });
}
export default Sun;