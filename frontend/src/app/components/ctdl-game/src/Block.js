import blockSprite from './sprites/block';
import { CTDLGAME } from './gameUtils';
import { addTextToQueue } from './textUtils';
import constants from './constants';
import { setButtonClicked } from './events';
import GameObject from './GameObject';

class Block extends GameObject {
  constructor(id, options) {
    super(id, options);
    this.spriteData = { x: 0, y: 0, w: 6, h: 6 };
    this.context = constants[options.context || 'gameContext'];
    this.w = options.w || 6;
    this.h = options.h || 6;
    this.isSolid = options.isSolid;
    this.opacity = options.opacity || 1;
    this.status = options.status;
    this.info = options.info || {};
  }

  toggleSolid = () => {
    this.isSolid = !this.isSolid;
  };

  update = () => {
    const sprite = CTDLGAME.assets.block;

    let data = blockSprite['block'];
    if (!this.isSolid) data = blockSprite['backgroundBlock'];
    if (this.info.height === 0 && this.isSolid) data = blockSprite['genesisBlock'];
    if (this.info.height === 0 && !this.isSolid) data = blockSprite['genesisBackgroundBlock'];
    this.context.globalAlpha = this.opacity;
    this.context.drawImage(
      sprite,
      data.x, data.y, data.w, data.h,
      this.x, this.y, this.w, this.h
    );

    if (this.status === 'bad') {
      this.context.strokeStyle = '#F00';
      this.context.beginPath();
      this.context.moveTo(this.x - .5 , this.y - .5);
      this.context.lineTo(this.x - .5  + this.w, this.y - .5 + this.h);
      this.context.moveTo(this.x - .5  + this.w, this.y - .5);
      this.context.lineTo(this.x - .5 , this.y - .5 + this.h);
      this.context.stroke();
    }
  };

  select = () => {
    setButtonClicked(this);
    addTextToQueue(this.info.height > 0 ? 'Block: ' + this.info.height : 'Genesisblock');
  };

  toJSON = this._toJSON;
}
export default Block;