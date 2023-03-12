import { CTDLGAME } from './gameUtils';
import constants from './constants';
import GameObject from './GameObject';

class Ramp extends GameObject {
  constructor(id, context, options) {
    super(id, options);
    this.sprite = options.sprite;
    this.context = context;
    this.w = options.w || 8;
    this.h = options.h || 8;
    this.heightMap = options.heightMap;
    this.spriteData = options.spriteData || { x: 0, y: 0, w: this.w, h: this.h};
    this.isSolid = options.isSolid;
    this.spawnPoint = options.spawnPoint;
    this.status = options.status;
  }

  toggleSolid = () => {
    this.isSolid = !this.isSolid;
  };

  makeToggle = isSolid => {
    this.isSolid = isSolid;
    this.backEvent = character => {
      this.isSolid = true;
      character.y = this.getTrueY() - character.getBoundingBox().h;
    };
    this.downEvent = () => {
      this.isSolid = false;
    };
  };

  getHeightMap = () => {
    if (this.heightMap) return this.heightMap;

    constants.helperCanvas.width = 8;
    constants.helperCanvas.height = 8;
    constants.helperContext.clearRect(0, 0, 8, 8);
    constants.helperContext.drawImage(
      CTDLGAME.assets[this.sprite],
      this.spriteData.x, this.spriteData.y, this.spriteData.w, this.spriteData.h,
      0, 0, this.spriteData.w, this.spriteData.h
    );
    const imageData = constants.helperContext.getImageData(0, 0, this.spriteData.w, this.spriteData.h);
    // return only the alpha
    this.heightMap = imageData.data
      .filter((val, i) => (i + 1) % 4 === 0)
      .reduce((rows, val) => { // make array two dimensional
        const foundRow = rows.find(row => {
          if (row.length < this.w) {
            row.push(val);
            return true;
          }
        });
        if (!foundRow) {
          rows.push([val]);
        }
        return rows;
      }, [[]]);

    return this.heightMap;
  };

  getTrueY = () => {
    if (this.trueY) return this.trueY;
    const heightMap = this.getHeightMap();
    this.trueY = this.y + heightMap.findIndex(row => row.indexOf(255) >= 0);
    return this.trueY;
  };
}
export default Ramp;