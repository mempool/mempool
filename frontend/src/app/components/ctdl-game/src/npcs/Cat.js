import { BehaviorTree, Selector, Task, SUCCESS, FAILURE } from 'behaviortree';

import catSpriteData from '../sprites/cat';
import { CTDLGAME } from '../gameUtils';
import { moveObject, intersects, getClosest } from '../geometryUtils';
import { write } from '../font';
import constants from '../constants';
import { addTextToQueue } from '../textUtils';
import Agent from '../Agent';
import { random } from '../arrayUtils';

const sprites = [
  'bisq',
];

const lick = new Task({
  run: agent => {
    // only lick sometimes and not forever
    if (Math.random() > .005 && agent.status !== 'lick') return FAILURE;
    if (Math.random() < .05) return FAILURE;
    agent.status = 'lick';

    return SUCCESS;
  }
});

const moveToFriend = new Task({
  run: agent => {
    if (!agent.closestFriend || agent.goal || Math.random() < .95) return FAILURE;
    agent.goal = agent.closestFriend.x;
    return SUCCESS;
  }
});
const moveToPointX = new Task({
  run: agent => {
    if (!agent.goal && Math.random() < .008) {
      agent.goal = Math.round(Math.random() * CTDLGAME.world.w);
      agent.status = 'move';
    }
    if (Math.abs(agent.x - agent.goal) < 5) agent.goal = null;
    if (!agent.goal || agent.status !== 'move') return FAILURE;

    if (agent.x < agent.goal) return agent.moveRight.condition() ? agent.moveRight.effect() : FAILURE;
    if (agent.x > agent.goal) return agent.moveLeft.condition() ? agent.moveLeft.effect() : FAILURE;
    return agent.moveRandom.condition() ? agent.moveRandom.effect() : FAILURE;
  }
});

const runToPointX = new Task({
  run: agent => {
    if (!agent.goal && Math.random() < .002) {
      agent.goal = Math.round(Math.random() * CTDLGAME.world.w);
      agent.status = 'run';
    }
    if (Math.abs(agent.x - agent.goal) < 10) agent.goal = null;
    if (!agent.goal || agent.status !== 'run') return FAILURE;
    if (agent.x < agent.goal) return agent.runRight.condition() ? agent.runRight.effect() : FAILURE;
    if (agent.x > agent.goal) return agent.runLeft.condition() ? agent.runLeft.effect() : FAILURE;
  }
});

// Selector: runs until one node calls success
const regularBehaviour = new Selector({
  nodes: [
    moveToFriend,
    moveToPointX,
    runToPointX,
    lick,
    'idle'
  ]
});


const tree = new Selector({
  nodes: [
    'survive',
    regularBehaviour
  ]
});

class Cat extends Agent {
  constructor(id, options) {
    super(id, options);
    this.spriteId = options.spriteId || random(sprites);
    this.spriteData = catSpriteData;
    this.maxHealth = options.maxHealth ?? Math.round(Math.random() * 5) + 5;
    this.health = options.health ?? this.maxHealth;
    this.strength = 1;
    this.status = options.status || 'idle';
    this.attackRange = options.attackRange ?? Math.ceil(Math.random() * 70) + 70;
    this.senseRadius = this.attackRange;
    this.walkingSpeed = options.walkingSpeed || 2;
    this.runningSpeed = options.runningSpeed || 6;
    this.protection = 0;

    this.goal = options.goal;
    if (!this.goal && Math.random() < .5 && CTDLGAME.world) this.goal = Math.round(Math.random() * CTDLGAME.world.w);
  }

  w = 15;
  h = 9;
  applyGravity = true;

  bTree = new BehaviorTree({
    tree,
    blackboard: this
  });

  runLeft = {
    condition: () => true,
    effect: () => {
      this.direction = 'left';
      this.isMoving = 'left';
      const hasMoved = !moveObject(this, { x: -this.runningSpeed, y: 0 }, CTDLGAME.quadTree);

      if (hasMoved) {
        this.status = 'run';
        return SUCCESS;
      }

      return FAILURE;
    }
  };
  runRight = {
    condition: () => true,
    effect: () => {
      this.direction = 'right';
      this.isMoving = 'right';

      const hasMoved = !moveObject(this, { x: this.runningSpeed , y: 0}, CTDLGAME.quadTree);
      if (hasMoved) {
        this.status = 'run';
        return SUCCESS;
      }

      return FAILURE;
    }
  };

  hurt = (dmg, direction) => {
    if (/hurt|rekt/.test(this.status) || this.protection > 0) return;
    const lostFullPoint = Math.floor(this.health) - Math.floor(this.health - dmg) > 0;
    this.health = Math.max(this.health - dmg, 0);

    if (!lostFullPoint) return;

    this.dmgs.push({
      x: Math.round((Math.random() - .5) * 8),
      y: -8,
      dmg: Math.ceil(dmg)
    });
    this.status = 'hurt';
    this.vx = direction === 'left' ? 5 : -5;
    this.vy = -3;
    this.protection = 8;
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    }
  };

  die = () => {
    this.status = 'rekt';
    this.health = 0;
    this.removeTimer = 64;

    addTextToQueue(`Cat got rekt`);
  };

  draw = () => {
    if (!this.sprite) {
      this.sprite = CTDLGAME.assets[this.spriteId];
    }
    const spriteData = this.spriteData[this.direction][this.status];

    if (this.frame >= spriteData.length) {
      this.frame = 0;
    }

    const data = spriteData[this.frame];
    this.w = data.w;
    this.h = data.h;

    constants.charContext.globalAlpha = data.opacity ?? 1;
    if (this.protection > 0) {
      this.protection--;
      constants.charContext.globalAlpha = this.protection % 2;
    }

    // TODO check if this can be refactored
    constants.charContext.drawImage(
      this.sprite,
      data.x, data.y, this.w, this.h,
      this.x, this.y, this.w, this.h
    );
    constants.charContext.globalAlpha = 1;
  };

  update = () => {
    if (CTDLGAME.lockCharacters) {

      this.draw();
      return;
    }

    this.applyPhysics();
    if (this.status === 'fall') this.status = 'run';

    if (this.status === 'hurt' && this.vx === 0 && this.vy === 0) {
      this.status = 'idle';
    }

    const senseBox = this.getSenseBox();
    this.sensedObjects = CTDLGAME.quadTree.query(senseBox);

    this.touchedObjects = CTDLGAME.quadTree
      .query(this.getBoundingBox())
      .filter(obj => intersects(this.getBoundingBox(), obj.getBoundingBox()));


    if (window.DRAWSENSORS) {
      constants.charContext.beginPath();
      constants.charContext.rect(senseBox.x, senseBox.y, senseBox.w, senseBox.h);
      constants.charContext.stroke();
    }

    this.sensedEnemies = this.sensedObjects
      .filter(enemy => enemy.enemy && enemy.health && enemy.health > 0)
      .filter(enemy => Math.abs(enemy.getCenter().x - this.getCenter().x) <= this.senseRadius);

    this.sensedFriends = this.sensedObjects
      .filter(friend => /Character|Cat|Czino|Luma/.test(friend.getClass()) && friend.id !== this.id && friend.status !== 'rekt')
      .filter(friend => Math.abs(friend.getCenter().x - this.getCenter().x) <= this.senseRadius);

    if (Math.abs(this.vy) < 3 && !/fall|rekt|hurt/.test(this.status)) {
      this.closestEnemy = getClosest(this, this.sensedEnemies);
      this.closestFriend = getClosest(this, this.sensedFriends);
      this.bTree.step();
    }

    if (this.status !== 'idle' || Math.random() < .05) {
      this.frame++;
    }

    if (this.frame >= this.spriteData[this.direction][this.status].length) {
      this.frame = 0;
      if (/action/.test(this.status)) this.status = 'idle';
    }

    this.draw();

    this.dmgs = this.dmgs
      .filter(dmg => dmg.y > -24)
      .map(dmg => {
        write(constants.charContext, `-${dmg.dmg}`, {
          x: this.getCenter().x - 6,
          y: this.y + dmg.y,
          w: 12
        }, 'center', false, 4, true, '#F00');
        return {
          ...dmg,
          y: dmg.y - 1
        };
      });
    this.says = this.says
      .filter(say => say.y > -24)
      .map(say => {
        write(constants.charContext, say.say, {
          x: this.getCenter().x - 26,
          y: this.y + say.y,
          w: 52
        }, 'center', false, 5, false, '#FFF');
        return {
          ...say,
          y: say.y - 1
        };
      });
  };

  getBoundingBox = () => ({ // rekt
      id: this.id,
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h
    });

  getAnchor = () => ({
      x: this.getBoundingBox().x,
      y: this.getBoundingBox().y + this.getBoundingBox().h - 1,
      w: this.getBoundingBox().w,
      h: 1
  });
}
export default Cat;