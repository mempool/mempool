import constants from './constants';
import { CTDLGAME, loadAsset, showProgressBar } from './gameUtils';
import { intersects } from './geometryUtils';
import { canDrawOn } from './performanceUtils';
import Moon from './Moon';
import Sun from './Sun';

const sun = new Sun({
  x: CTDLGAME.viewport.x + constants.WIDTH / 2,
  y: CTDLGAME.viewport.y + 10
});
const moon = new Moon({
  x: CTDLGAME.viewport.x + constants.WIDTH / 2,
  y: CTDLGAME.viewport.y + 10
});
class World {
  constructor(id, map) {
    this.id = id;

    this.map = map;
    this.w = this.map.world.w;
    this.h = this.map.world.h;
    CTDLGAME.objects = CTDLGAME.objects.concat(this.map.events);
    CTDLGAME.lightSources = this.map.lightSources;

    this.loadAssets();
  }

  loadAssets = async () => {
    let i = 0;
    const len = Object.keys(this.map.assets).length;

    for (const key in this.map.assets) {
      if (!CTDLGAME.assets[key]) {
        CTDLGAME.assets[key] = await loadAsset(this.map.assets[key]);
        constants.overlayContext.clearRect(CTDLGAME.viewport.x, CTDLGAME.viewport.y, constants.WIDTH, constants.HEIGHT);
      }

      showProgressBar(i / (len - 1));
      i++;
    }
    this.ready = true;
  };

  update = () => {
    const sprite = CTDLGAME.assets[this.id];

    if (this.map.overworld) {
      sun.update();
      moon.update();
    } else if (this.map.bgColor) {
      constants.skyContext.globalAlpha = 1;
      constants.skyContext.fillStyle = CTDLGAME.world.map.bgColor();
      constants.skyContext.fillRect(CTDLGAME.viewport.x, CTDLGAME.viewport.y, constants.WIDTH, constants.HEIGHT);
    }
    if (this.map.parallax.length > 0 && canDrawOn('parallaxContext')) {
      const parallaxViewport = {
        x: Math.round(CTDLGAME.viewport.x / 2),
        y: Math.round(CTDLGAME.viewport.y / 4 + CTDLGAME.world.h / 4 * 3 - 144),
        w: CTDLGAME.viewport.w,
        h: CTDLGAME.viewport.h
      };
      this.map.parallax
        .filter(tile => intersects(tile, parallaxViewport))
        .map(tile => {
          constants.parallaxContext.drawImage(
            sprite,
            tile.tile[0], tile.tile[1], tile.w, tile.h,
            tile.x, tile.y, tile.w, tile.h
          );
        });
        if (CTDLGAME.skyColor) {
          constants.parallaxContext.globalCompositeOperation = 'source-atop';
          constants.parallaxContext.globalAlpha = .2;
          constants.parallaxContext.fillStyle = `hsl(${CTDLGAME.skyColor.h}, ${CTDLGAME.skyColor.s}%, ${CTDLGAME.skyColor.l}%)`;
          constants.parallaxContext.fillRect(
            parallaxViewport.x, parallaxViewport.y, constants.WIDTH, constants.HEIGHT
          );
          constants.parallaxContext.globalAlpha = 1;
          constants.parallaxContext.globalCompositeOperation = 'source-over';
        }
    }

    if (this.map.bg.length > 0 && canDrawOn('bgContext')) {
      this.map.bg
        .filter(tile => intersects(tile, CTDLGAME.viewport))
        .map(tile => {
          constants.bgContext.drawImage(
            sprite,
            tile.tile[0], tile.tile[1], tile.w, tile.h,
            tile.x, tile.y, tile.w, tile.h
          );
        });
    }

    if (this.map.base && this.map.base.length > 0 && canDrawOn('gameContext')) {
      this.map.base
        .filter(tile => intersects(tile, CTDLGAME.viewport))
        .map(tile => {
          constants.gameContext.drawImage(
            sprite,
            tile.tile[0], tile.tile[1], tile.w, tile.h,
            tile.x, tile.y, tile.w, tile.h
          );
        });
    }

    if (this.map.fg.length > 0 && canDrawOn('fgContext')) {
      this.map.fg
        .filter(tile => intersects(tile, CTDLGAME.viewport))
        .map(tile => {
          constants.fgContext.drawImage(
            sprite,
            tile.tile[0], tile.tile[1], tile.w, tile.h,
            tile.x, tile.y, tile.w, tile.h
          );
        });
    }
  };
}
export default World;