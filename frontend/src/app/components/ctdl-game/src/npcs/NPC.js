import NPCSprite from '../sprites/NPCs';
import { CTDLGAME } from '../gameUtils';
import constants from '../constants';
import Agent from '../Agent';
import { addTextToQueue } from '../textUtils';
import { random } from '../arrayUtils';

class NPC extends Agent {
  constructor(id, options) {
    super(id, options);
    this.spriteData = NPCSprite[this.id];

    if (this.spriteData) {
      this.w = this.spriteData.frames[0].w;
      this.h = this.spriteData.frames[0].h;
      this.thingsToSayTouch = this.spriteData.thingsToSayTouch;
      this.thingsToSaySelect = this.spriteData.thingsToSaySelect;
      if (this.spriteData.select) this.select = this.spriteData.select;
      if (this.spriteData.touch) this.touch = this.spriteData.touch;
    }

    this.frame = 0;
    this.isSolid = options.isSolid;
    this.status = options.status;
    this.info = options.info || {};
  }

  applyGravity = true;

  update = () => {
    const data = this.spriteData.frames[this.frame];

    if (!this.spriteData.static) this.frame++;
    if (this.frame >= this.spriteData.frames.length) {
      this.frame = 0;
    }

    constants.gameContext.drawImage(
      CTDLGAME.assets[this.spriteData.sprite || 'NPCs'],
      data.x, data.y, data.w, data.h,
      this.x, this.y, this.w, this.h
    );
  };

  select = () => {
    if (!this.thingsToSaySelect || this.isSelected) return;
    this.isSelected = true;

    const whatToSay = random(this.thingsToSaySelect);
      whatToSay.map((text, index) => {
        if (index === whatToSay.length - 1) {
          addTextToQueue(text, () => {
            this.isSelected = false;
          });
        } else {
          addTextToQueue(text);
        }
      });
  };

  touch = () => {
    if (!this.thingsToSayTouch || this.isTouched) return;
    this.isTouched = true;

    const whatToSay = random(this.thingsToSayTouch);
      whatToSay.map((text, index) => {
        if (index === whatToSay.length - 1) {
          addTextToQueue(text, () => {
            this.isTouched = false;
          });
        } else {
          addTextToQueue(text);
        }
      });
  };
  unselect = () => {};
}
export default NPC;