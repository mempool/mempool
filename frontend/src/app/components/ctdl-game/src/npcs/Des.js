import constants from '../constants';
import { CTDLGAME } from '../gameUtils';
import spriteData from '../sprites/des';
import NPC from './NPC';

class Des extends NPC {
  constructor(id, options) {
    super(id, options);
    this.spriteData = spriteData;
    this.w = this.spriteData[this.direction][this.status][0].w;
    this.h = this.spriteData[this.direction][this.status][0].h;
    this.thingsToSayTouch = [['Des:\nBurn it all down!']];
    this.thingsToSaySelect = [['Des:\nPlay games. Stack sats']];
  }

  direction = 'left';
  status = 'idle';

  update = () => {
    const spriteData = this.spriteData[this.direction][this.status];

    if (this.frame >= spriteData.length) {
      this.frame = 0;
    }

    const data = spriteData[this.frame];

    constants.gameContext.drawImage(
      CTDLGAME.assets.des,
      data.x, data.y, data.w, data.h,
      this.x, this.y, this.w, this.h
    );

    this.frame++;
  };

  applyGravity = false;
}
export default Des;