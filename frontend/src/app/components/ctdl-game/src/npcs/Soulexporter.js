import constants from '../constants';
import { CTDLGAME } from '../gameUtils';
import spriteData from '../sprites/soulexporter';
import NPC from './NPC';

class Soulexporter extends NPC {
  constructor(id, options) {
    super(id, options);
    this.spriteData = spriteData;
    this.w = this.spriteData[this.direction][this.status][0].w;
    this.h = this.spriteData[this.direction][this.status][0].h;
    this.thingsToSayTouch = [['Soul Exporter:\nStack hard memories.']];
    this.thingsToSaySelect = [['Soul Exporter:\nThe only thing scarcer than Bitcoin is Time.']];
  }

  direction = 'right';
  status = 'idle';

  update = () => {
    const spriteData = this.spriteData[this.direction][this.status];

    if (this.frame >= spriteData.length) {
      this.frame = 0;
    }

    const data = spriteData[this.frame];

    constants.fgContext.drawImage(
      CTDLGAME.assets.soulexporter,
      data.x, data.y, data.w, data.h,
      this.x, this.y, this.w, this.h
    );

    this.frame++;
  };

  applyGravity = false;
}
export default Soulexporter;