import constants from './constants';
import { CTDLGAME } from './gameUtils';
import { moveObject } from './geometryUtils';
import spriteData from './sprites/items';
import { playSound } from './sounds';
import { addTextToQueue } from './textUtils';
import GameObject from './GameObject';

// TODO move to /objects
class Item extends GameObject {
  constructor(id, options) {
    super(id, options);
    this.applyGravity = options.applyGravity ?? true;
    this.spriteData = spriteData[this.id];
    this.w = this.spriteData.w;
    this.h = this.spriteData.h;
  }

  collected = false;

  touch = character => {
    if (this.collected || this.vy < 0) return;
    this.remove = true;
    this.collected = true;
    
    if (this.id === 'pizza') {
      if (character.heal(2)) {
        playSound('item');
      } else {
        this.remove = false;
        this.collected = false;
      }
    } else if (this.id === 'taco') {
      if (character.heal(5)) {
        playSound('item');
      } else {
        this.remove = false;
        this.collected = false;
      }
    } else if (this.id === 'steak') {
      if (character.heal(21000000)) {
        playSound('item');
      } else {
        this.remove = false;
        this.collected = false;
      }
    } else if (this.id === 'opendime') {
      const sats = Math.round(Math.random() * 13370);
      addTextToQueue(`You found an opendime with\nș${sats}`, () => {
        CTDLGAME.inventory.sats += sats;
      });
      playSound('item');
    } else if (this.id === 'coldcard') {
      const sats = Math.round(Math.random() * 615000);
      addTextToQueue(`You found a coldcard with\nș${sats}`, () => {
        CTDLGAME.inventory.sats += sats;
      });
      playSound('item');
    } else if (this.id === 'honeybadger') {
      addTextToQueue('You gained the strength\nof the honey badger');
      character.strength += Math.round(Math.random() + 1);
      character.maxHealth += Math.round(Math.random() * 3 + 1);
      character.heal(character.maxHealth);
      playSound('honeyBadger');
    } else if (this.id === 'orangePill') {
      addTextToQueue('The orange pill makes\nyou more vital');
      character.maxHealth += Math.round(Math.random() * 3 + 1);
      character.heal(Math.round(character.maxHealth / 2));
      playSound('honeyBadger');
    } else if (this.id === 'phoenix') {
      if (CTDLGAME.inventory.phoenix >= 2) {
        this.remove = false;
        this.collected = false;
      } else {
        addTextToQueue('Like the Phoenix, you\'ll rise\nfrom the ashes.');
        CTDLGAME.inventory.phoenix++;
        playSound('honeyBadger');
      }
    }
  };
  update = () => {
    if (this.vx !== 0) {
      if (this.vx > 18) this.vx = 18;
      if (this.vx < -18) this.vx = -18;
      moveObject(this, { x: this.vx , y: 0 }, CTDLGAME.quadTree);
      if (this.vx < 0) this.vx += 1;
      if (this.vx > 0) this.vx -= 1;
    }

    if (this.vy !== 0) {
      if (this.vy > 6) this.vy = 6;
      if (this.vy < -6) this.vy = -6;
      const hasCollided = moveObject(this, { x: 0 , y: this.vy }, CTDLGAME.quadTree);

      if (hasCollided) {
        this.vy = 0;
      }
    }
    constants.gameContext.drawImage(
      CTDLGAME.assets.items,
      this.spriteData.x, this.spriteData.y, this.spriteData.w, this.spriteData.h,
      this.x, this.y + Math.round(Math.sin(CTDLGAME.frame / 16)), this.w, this.h
    );
  };

  getAnchor = () => ({
      x: this.getBoundingBox().x,
      y: this.getBoundingBox().y + this.getBoundingBox().h,
      w: this.getBoundingBox().w,
      h: 1
  });

  toJSON = this._toJSON;
}
export default Item;