import { BehaviorTree, Selector, Sequence, Task, SUCCESS, FAILURE, RUNNING } from 'behaviortree';

import hodlonaut from './sprites/hodlonaut';
import katoshi from './sprites/katoshi';
import { CTDLGAME } from './gameUtils';
import { moveObject, intersects, getClosest } from './geometryUtils';
import { capitalize } from './stringUtils';
import constants from './constants';
import { addTextToQueue } from './textUtils';
import { playSound } from './sounds';
import { duckButton, backButton } from './events';
import Agent from './Agent';
import { canDrawOn } from './performanceUtils';

const sprites = {
  hodlonaut,
  katoshi
};

const touchesEnemy = new Task({
  run: agent => agent.closestEnemy && intersects(agent.getBoundingBox(), agent.closestEnemy.getBoundingBox()) ? SUCCESS : FAILURE
});
const duck = new Task({
  run: agent => agent.duck.condition() ? agent.duck.effect() : FAILURE
});
const standUp = new Task({
  run: agent => agent.standUp.condition() ? agent.standUp.effect() : FAILURE
});
const friendDucks = new Task({
  run: () => /duck/i.test(window.SELECTEDCHARACTER.status)
});


// Sequence: runs each node until fail
const attackEnemy = new Sequence({
  nodes: [
    'lookAtEnemy',
    touchesEnemy,
    'attack'
  ]
});

// Selector: runs until one node calls success
const goToEnemy = new Sequence({
  nodes: [
    'seesEnemy',
    'doesNotTouchEnemy',
    new Selector({
      nodes: [
        'moveToClosestEnemy',
        'jump',
        duck
      ]
    })
  ]
});


// Selector: runs until one node calls success
const goToFriend = new Sequence({
  nodes: [
    'follows',
    'seesFriend',
    new Selector({
      nodes: [
        'moveToFriend',
        'jump',
        duck
      ]
    })
  ]
});

const duckSequence = new Sequence({
  nodes: [
    friendDucks,
    duck,
    new Selector({
      nodes: [
        attackEnemy,
        goToEnemy,
        goToFriend
      ]
    })
  ]
});
const standingSequnce = new Sequence({
  nodes: [
    standUp,
    new Selector({
      nodes: [
        attackEnemy,
        goToEnemy,
        goToFriend,
        'moveRandom',
        'idle'
      ]
    })
  ]
});

const tree = new Selector({
  nodes: [
    'survive',
    duckSequence,
    standingSequnce,
  ]
});

class Character extends Agent {
  constructor(id, options) {
    super(id, options);
    this.spriteData = sprites[id.replace(/-|\d/g, '')];
    this.sprite = CTDLGAME.assets[id.replace(/-|\d/g, '')];
    this.context = options.context || 'charContext';
    this.maxHealth = options.maxHealth ?? 21;
    this.health = options.health ?? 21;
    this.selected = options.selected;
    this.strength = options.strength || (/hodlonaut/.test(id) ? 1 : 3);
    this.attackRange = /hodlonaut/.test(id) ? 4 : 8;
    this.senseRadius = options.senseRadius || 50;
    this.follow = options.follow ?? true;
    this.walkingSpeed = options.walkingSpeed || 3;
    this.duckSpeed = options.duckSpeed || 2;
    this.swims = options.swims;
    this.protection = 0;
    this.rektIn = options.rektIn;
    this.oneHitWonder = options.oneHitWonder;
  }

  w = 16;
  h = 30;

  bTree = new BehaviorTree({
    tree,
    blackboard: this
  });

  idle = {
    condition: () => true,
    effect: () => {
      if (!this.canStandUp() && this.duck.condition()) return this.duck.effect();
      this.status = 'idle';
      return SUCCESS;
    }
  };
  moveLeft = {
    condition: () => true,
    effect: () => {
      if (!this.canStandUp() && this.duckMoveLeft.condition()) return this.duckMoveLeft.effect();

      this.direction = 'left';

      const hasMoved = !moveObject(this, { x: -this.walkingSpeed, y: 0 }, CTDLGAME.quadTree);

      if (hasMoved) {
        this.status = 'move';
        return SUCCESS;
      }

      // if couldn't move, check if downEvent frees path
      this.checkDownEvents();

      return FAILURE;
    }
  };
  moveRight = {
    condition: () => true,
    effect: () => {
      if (!this.canStandUp() && this.duckMoveRight.condition()) return this.duckMoveRight.effect();

      this.direction = 'right';

      const hasMoved = !moveObject(this, { x: this.walkingSpeed , y: 0}, CTDLGAME.quadTree);

      if (hasMoved) {
        this.status = 'move';
        return SUCCESS;
      }

      // if couldn't move, check if downEvent frees path
      this.checkDownEvents();

      return FAILURE;
    }
  };
  standUp = {
    condition: () => this.canStandUp(),
    effect: () => {
      if (/attack/i.test(this.status)) {
        this.status = 'attack';
      } else if (/move/i.test(this.status)) {
        this.status = 'move';
      } else {
        this.status = 'idle';
      }
      return SUCCESS;
    }
  };
  duck = {
    condition: () => true,
    effect: () => {
      this.status = 'duck';
      this.checkDownEvents();
      return SUCCESS;
    }
  };
  duckMoveLeft = {
    condition: () => this.canDuck(),
    effect: () => {
      this.direction = 'left';
      this.status = 'duckMove';
      this.checkDownEvents();

      const hasMoved = !moveObject(this, { x: -this.duckSpeed, y: 0 }, CTDLGAME.quadTree);
      return hasMoved ? SUCCESS : FAILURE;
    }
  };
  duckMoveRight = {
    condition: () => this.canDuck(),
    effect: () => {
      this.direction = 'right';
      this.status = 'duckMove';
      this.checkDownEvents();

      const hasMoved = !moveObject(this, { x: this.duckSpeed, y: 0 }, CTDLGAME.quadTree);
      return hasMoved ? SUCCESS : FAILURE;
    }
  };
  attack = {
    condition: () => true,
    effect: () => {
      if (!/attack/i.test(this.status)) this.frame = 0;
      this.status = /duck/i.test(this.status) ? 'duckAttack': 'attack';

      if (this.id === 'katoshi' && this.frame !== 3) return SUCCESS;
      this.makeDamage(1);
      return SUCCESS;
    }
  };
  attackMoveLeft = {
    condition: () => true,
    effect: () => {
      this.direction = 'left';
      const hasMoved = !moveObject(this, { x: -this.walkingSpeed, y: 0 }, CTDLGAME.quadTree);

      if (hasMoved) {
        this.status = /duck/i.test(this.status) ? 'duckMoveAttack': 'moveAttack';
        if (this.id === 'katoshi' && this.frame !== 3) return RUNNING;
        this.makeDamage(this.id === 'katoshi' ? .8 : 1);
        return SUCCESS;
      }
      return FAILURE;
    }
  };
  attackMoveRight = {
    condition: () => true,
    effect: () => {
      this.direction = 'right';

      const hasMoved = !moveObject(this, { x: this.walkingSpeed , y: 0}, CTDLGAME.quadTree);
      if (hasMoved) {
        this.status = /duck/i.test(this.status) ? 'duckMoveAttack': 'moveAttack';
        if (this.id === 'katoshi' && this.frame !== 3) return RUNNING;
        this.makeDamage(this.id === 'katoshi' ? .8 : 1);
        return SUCCESS;
      }
      return FAILURE;
    }
  };
  jump = {
    condition: () => this.canJump() && this.canStandUp(),
    effect: () => {
      if (this.status !== 'jump') this.frame = 0;
      this.status = 'jump';
      this.vx = this.direction === 'right' ? 6 : -6;
      this.vy = -6;

      const boundingBox = this.getBoundingBox();
      const eventObject =  CTDLGAME.quadTree.query(boundingBox)
        .filter(obj => obj.jumpEvent)
        .find(obj => intersects(boundingBox, obj.getBoundingBox()));

      if (eventObject) eventObject.jumpEvent(this);

      return SUCCESS;
    }
  };
  back = {
    condition: () => this.canStandUp(),
    effect: () => {
      this.status = 'back';

      const boundingBox = this.getBoundingBox();
      const eventObject =  CTDLGAME.quadTree.query(boundingBox)
        .filter(obj => obj.backEvent)
        .find(obj => intersects(boundingBox, obj.getBoundingBox()));

      if (!eventObject) return FAILURE;

      eventObject.backEvent(this);
      return SUCCESS;
    }
  };
  action = {
    condition: () => this.canStandUp(),
    effect: () => {
      this.frame = 0;
      this.status = 'action';
      return SUCCESS;
    }
  };
  checkDownEvents = () => {
    if (!this.selected) return;
    const boundingBox = this.getBoundingBox();
    const eventObject =  CTDLGAME.quadTree.query(boundingBox)
      .filter(obj => obj.downEvent)
      .find(obj => intersects(boundingBox, obj.getBoundingBox()));

    if (eventObject) eventObject.downEvent(this);
  };

  canDuck = () => {
    if (this.selected) return true;

    // otherwise check if AI should want to duck
    const duckTo = this.getBoundingBox();
    duckTo.y += 6;
    duckTo.x += this.direction === 'right' ? 3 : -3;
    duckTo.h -= 10; // 4 extra for walking up slopes

    if (window.DRAWSENSORS) {
      constants.overlayContext.globalAlpha = .5;
      constants.overlayContext.fillStyle = 'blue';
      constants.overlayContext.fillRect(duckTo.x, duckTo.y, duckTo.w, duckTo.h);
      constants.overlayContext.globalAlpha = 1;
    }
    const obstacles = CTDLGAME.quadTree.query(duckTo)
      .filter(obj => obj.isSolid && !obj.enemy && /Tile|Ramp|Boundary/.test(obj.getClass()))
      .filter(obj => intersects(obj, duckTo));

    return obstacles.length === 0;
  };

  canStandUp = () => {
    if (!/duck/i.test(this.status)) return true;
    const standUpTo = this.getBoundingBox();
      standUpTo.y -= 6;
      // standUpTo.x += this.direction === 'right' ? 2 : -2 // do not stand up if you face obstacle
      standUpTo.h = 6;

    if (window.DRAWSENSORS) {
      constants.overlayContext.globalAlpha = .5;
      constants.overlayContext.fillStyle = 'green';
      constants.overlayContext.fillRect(standUpTo.x, standUpTo.y, standUpTo.w, standUpTo.h);
      constants.overlayContext.globalAlpha = 1;
    }
    const obstacles = CTDLGAME.quadTree.query(standUpTo)
      .filter(obj => obj.isSolid && !obj.enemy && /Tile|Ramp/.test(obj.getClass()))
      .filter(obj => intersects(obj, standUpTo));

    return obstacles.length === 0;
  };

  makeDamage = multiplier => {
    if (this.id === 'hodlonaut') playSound('lightningTorch');
    if (this.id === 'katoshi') playSound('sword');
    const boundingBox = this.getBoundingBox();

    this.sensedEnemies
      .filter(enemy =>
        intersects({
          x: this.direction === 'left' ? boundingBox.x - this.attackRange + 3 : boundingBox.x + boundingBox.w - 3,
          y: boundingBox.y,
          w: this.attackRange,
          h: boundingBox.h
        }, enemy.getBoundingBox()))
      .filter((_, index) => index <= 2) // can only hurt 3 enemies at once
      .forEach(enemy => {
        let dmg = Math.round(this.strength * (1 + Math.random() / 4));
        if (/hodlonaut/.test(this.id)) dmg *= (1 + CTDLGAME.inventory.sats / 100000000);

        enemy.hurt(Math.round(dmg * multiplier), this.direction === 'left' ? 'right' : 'left', this);
      });

    if (this.oneHitWonder) this.remove = true;
  };

  hurt = (dmg, direction, agent) => {
    if (!this.hurtCondition(dmg, direction)) return;
    const lostFullPoint = Math.floor(this.health) - Math.floor(this.health - dmg) > 0;
    this.health = Math.max(this.health - dmg, 0);

    if (!lostFullPoint) return;

    if (agent) agent.enemy = true;

    this.dmgs.push({
      x: Math.round((Math.random() - .5) * 8),
      y: -8,
      dmg: Math.ceil(dmg)
    });
    this.status = 'hurt';
    this.vx = direction === 'left' ? 5 : -5;
    this.vy = -3;
    this.protection = 8;
    playSound('playerHurt');
    if (this.health / this.maxHealth <= .2) this.say('help!');
    if (this.health <= 0) {
      this.health = 0;
      return this.die(); // :(
    }
    return this.onHurt();
  };

  stun = (direction, impact = 1) => {
    this.status = 'stun';
    this.vx = (direction === 'left' ? 5 : -5) * impact;
    this.vy = -3;
  };

  die = () => {
    if (this.oneHitWonder) {
      this.remove = true;
      return;
    }
    if (CTDLGAME.inventory.phoenix) {
      CTDLGAME.inventory.phoenix--;
      this.health = Math.round(this.maxHealth / 2);
      addTextToQueue('The fire is still strong\nwithin you.');
      return;
    }

    this.status = 'rekt';
    this.health = 0;
    this.rektIn = CTDLGAME.world.id;

    this.selected = false;
    if (this.id === 'hodlonaut') {
      CTDLGAME.katoshi.choose();
    } else {
      CTDLGAME.hodlonaut.choose();
    }

    addTextToQueue(`${capitalize(this.id)} got rekt`);
  };

  revive = (heal = 1) => {
    if (this.status !== 'rekt') return;
    this.y -= 21;
    this.status = 'idle';
    this.rektIn = null;
    this.health += heal;
  };

  senseControls = () => {
    const id = CTDLGAME.multiPlayer ? this.id : 'singlePlayer';

    let controls = [];
    if (CTDLGAME.touchScreen && this.selected) {
      controls = Object.keys(constants.CONTROLS[id])
        .filter(key => window.BUTTONS.some(button => button.action === constants.CONTROLS[id][key]))
        .map(key => constants.CONTROLS[id][key]);
    } else {
      controls = Object.keys(constants.CONTROLS[id])
        .filter(key => window.KEYS.indexOf(key) !== -1)
        .map(key => constants.CONTROLS[id][key]);
    }

    let action = 'idle';
    // merge mixed behaviours
    if (controls.indexOf('attack') !== -1 && controls.indexOf('moveLeft') !== -1) {
      action = 'attackMoveLeft';
    } else if (controls.indexOf('attack') !== -1 && controls.indexOf('moveRight') !== -1) {
      action = 'attackMoveRight';
    } else if (controls.indexOf('duck') !== -1 && controls.indexOf('attack') !== -1) {
      action = 'attack';
    } else if (controls.indexOf('duck') !== -1 && controls.indexOf('moveLeft') !== -1) {
      action = 'duckMoveLeft';
    } else if (controls.indexOf('duck') !== -1 && controls.indexOf('moveRight') !== -1) {
      action = 'duckMoveRight';
    } else if (controls.length > 0) {
      action = controls.pop();
    }

    if (this[action].condition()) this[action].effect();
  };

  draw = () => {
    if (!canDrawOn(this.context)) return;
    const spriteData = this.spriteData[this.direction][this.status];

    if (this.frame >= spriteData.length) {
      this.frame = 0;
    }

    const data = spriteData[this.frame];
    this.w = data.w;
    this.h = data.h;

    constants[this.context].globalAlpha = data.opacity ?? 1;
    if (this.protection > 0) {
      this.protection--;
      constants[this.context].globalAlpha = this.protection % 2;
    }

    const x = this.swims ? this.x + Math.round(Math.sin(CTDLGAME.frame / 16 + this.strength)) : this.x;
    constants[this.context].drawImage(
      this.sprite,
      data.x, data.y, this.w, this.h,
      x, this.y, this.w, this.h
    );
    constants[this.context].globalAlpha = 1;

    if (this.selected) {
      constants.charContext.fillStyle = '#0F0';
      constants.charContext.fillRect(
        this.x + this.w / 2, this.y - 2, 1, 1
      );
    }

    this.drawDmgs();
    this.drawHeals();
    this.drawSays();
  };

  update = () => {
    if (this.status === 'rekt' && this.rektIn !== CTDLGAME.world.id) return;

    this.applyPhysics();

    if (CTDLGAME.lockCharacters) {
      this.frame = 0;

      this.draw();
      return;
    }

    if (this.status === 'fall' && /hodlonaut/.test(this.id)) this.glows = false;
    if (this.status === 'fall' && this.vy === 0) this.status = 'idle';

    if (/stun|hurt/.test(this.status) && this.vx === 0 && this.vy === 0) this.status = 'idle';

    const boundingBox = this.getBoundingBox();
    const senseBox = this.getSenseBox();
    this.sensedObjects = CTDLGAME.quadTree.query(senseBox);

    if (window.DRAWSENSORS) {
      constants.charContext.beginPath();
      constants.charContext.rect(senseBox.x, senseBox.y, senseBox.w, senseBox.h);
      constants.charContext.stroke();
    }

    this.sensedEnemies = this.sensedObjects
      .filter(enemy => enemy.enemy && enemy.status !== 'rekt' && enemy.health > 0)
      .filter(enemy => intersects(senseBox, enemy));

    this.sensedFriends = this.sensedObjects
      .filter(friend => friend.getClass() === 'Character' && friend.status !== 'rekt')
      .filter(friend => intersects(senseBox, friend));

    this.touchedObjects = CTDLGAME.quadTree
      .query(boundingBox)
      .filter(obj => intersects(boundingBox, obj.getBoundingBox()));

    // collect touched items
    this.touchedObjects
      .filter(obj => obj.touch)
      .forEach(obj => obj.touch(this));

    if (CTDLGAME.inventory.phoenix > 0) {
      const rektFriend = this.touchedObjects
        .find(friend => friend.getClass() === 'Character' && friend.status === 'rekt');
      if (rektFriend) {
        addTextToQueue('You rise again like the\nPhoenix from the ashes!');
        rektFriend.revive(9);
        CTDLGAME.inventory.phoenix--;
      }
    }

    // sense backEvents
    if (CTDLGAME.touchScreen && this.selected) {
      const backEvent = this.touchedObjects.filter(obj => obj.backEvent);

      if (backEvent) {
        duckButton.active = false;
        backButton.active = true;
      } else {
        duckButton.active = true;
        backButton.active = false;
      }
    }

    if (Math.abs(this.vy) < 3 && !/jump|fall|rekt|hurt|action/.test(this.status)) {
      if (CTDLGAME.multiPlayer || this.selected) {
        this.senseControls();
      } else {
        this.closestEnemy = getClosest(this, this.sensedEnemies);
        this.closestFriend = getClosest(this, this.sensedFriends);
        this.bTree.step();
      }
    }

    if (/hodlonaut/.test(this.id)) {
      if (/attack/i.test(this.status)) {
        this.glows = true;
      } else {
        this.glows = false;
      }
    }

    // find out if touched objects have touch event
    this.touchedObjects
      .filter(obj => obj.touchEvent)
      .forEach(obj => obj.touchEvent(this));

    if (this.status !== 'idle' || Math.random() < .05) {
      this.frame++;
    }

    if (this.frame >= this.spriteData[this.direction][this.status].length) {
      this.frame = 0;
      if (/jump|action/.test(this.status)) this.status = 'idle';
    }

    this.draw();
  };

  select = () => {
    if (this.selected || CTDLGAME.multiPlayer || this.status === 'rekt') return;
    this.follow = !this.follow;
    window.SELECTEDCHARACTER.follow = this.follow;

    window.SELECTEDCHARACTER.say(this.follow ? 'come' : 'wait');
  };

  choose = () => {
    if (this.status === 'rekt') return;
    if (window.SELECTEDCHARACTER) window.SELECTEDCHARACTER.unselect();
    this.selected = true;
    window.SELECTEDCHARACTER = this;
  };

  unselect = () => {
    this.selected = false;
    window.SELECTEDCHARACTER = null;
  };

  getBoundingBox = () => /duck/i.test(this.status)
    ? ({ // ducking
      id: this.id,
      x: this.x + 6,
      y: this.y + 12,
      w: this.w - 12,
      h: this.h - 12
    })
    : this.status !== 'rekt'
    ? ({ // normal
        id: this.id,
        x: this.x + 6,
        y: this.y + 6,
        w: this.w - 12,
        h: this.h - 6
      })
    : ({ // rekt
      id: this.id,
      x: this.x + 5,
      y: this.y + 3,
      w: this.w - 10,
      h: this.h - 3
    });

  getAnchor = () => this.status !== 'rekt'
    ? ({
        x: this.getBoundingBox().x + 2,
        y: this.getBoundingBox().y + this.getBoundingBox().h - 1,
        w: this.getBoundingBox().w - 4,
        h: 1
    })
    : ({
      x: this.getBoundingBox().x,
      y: this.getBoundingBox().y + this.getBoundingBox().h - 1,
      w: this.getBoundingBox().w,
      h: 1
  });

  getLightSource = () => ({
    x: this.direction === 'left' ? this.getBoundingBox().x - 3: this.getBoundingBox().x + this.getBoundingBox().w + 3,
    y: this.getBoundingBox().y + 5,
    color: 'rgba(252, 249, 97, .2)',
    radius: 86,
    brightness: .4
  });
}
export default Character;