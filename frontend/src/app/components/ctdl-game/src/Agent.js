import { BehaviorTree, Selector, Sequence, Task, SUCCESS, FAILURE, RUNNING } from 'behaviortree';
import Item from './Item';
import { CTDLGAME } from './gameUtils';
import { moveObject, intersects } from './geometryUtils';
import { addTextToQueue } from './textUtils';
import constants from './constants';
import { canDrawOn } from './performanceUtils';
import GameObject from './GameObject';
import { write } from './font';

BehaviorTree.register('log', new Task({
  run: agent => {
    console.info(agent);
    return SUCCESS;
  }
}));

BehaviorTree.register('seesItem', new Task({
  run: agent => agent.sensedItems.length > 0 ? SUCCESS : FAILURE
}));
BehaviorTree.register('lookAtEnemy', new Task({
  run: agent => agent.closestEnemy && agent.lookAt.condition(agent.closestEnemy) ? agent.lookAt.effect(agent.closestEnemy) : FAILURE
}));

BehaviorTree.register('seesEnemy', new Task({
  run: agent => agent.sensedEnemies.length > 0 ? SUCCESS : FAILURE
}));

// TODO rename and restructure this
BehaviorTree.register('touchesEnemy', new Task({
  run: agent => agent.attack.condition() || (agent.attack2 && agent.attack2.condition()) || (agent.attack3 && agent.attack3.condition()) ? SUCCESS : FAILURE
}));

BehaviorTree.register('doesNotTouchEnemy', new Task({
  run: agent => !agent.closestEnemy || !intersects(agent.getBoundingBox(), agent.closestEnemy.getBoundingBox()) ? SUCCESS : FAILURE
}));
BehaviorTree.register('idle', new Task({
  run: agent => agent.idle.condition() ? agent.idle.effect() : FAILURE
}));
BehaviorTree.register('move', new Task({
  run: agent => agent.direction === 'left'
    ? agent.moveLeft.condition() ? agent.moveLeft.effect() : FAILURE
    : agent.moveRight.condition() ? agent.moveRight.effect() : FAILURE
}));
BehaviorTree.register('moveLeft', new Task({
  run: agent => agent.moveLeft.condition() ? agent.moveLeft.effect() : FAILURE
}));
BehaviorTree.register('moveRight', new Task({
  run: agent => agent.moveRight.condition() ? agent.moveRight.effect() : FAILURE
}));
BehaviorTree.register('moveRandom', new Task({
  run: agent => {
    // if already moving, continue journey
    if (agent.isMoving === 'left' && Math.random() < .95) return agent.moveLeft.condition() ? agent.moveLeft.effect() : FAILURE;
    if (agent.isMoving === 'right' && Math.random() < .95) return agent.moveRight.condition() ? agent.moveRight.effect() : FAILURE;
    agent.isMoving = false;
    return agent.moveRandom.condition() ? agent.moveRandom.effect() : FAILURE;
  }
}));
BehaviorTree.register('moveToPointX', new Task({
  run: agent => {
    if (!agent.goal && Math.random() < .05 * agent.business) agent.goal = Math.round(Math.random() * CTDLGAME.world.w);
    if (Math.abs(agent.x - agent.goal) < 5) agent.goal = null;
    if (!agent.goal) return FAILURE;
    if (agent.x < agent.goal) return agent.moveRight.condition() ? agent.moveRight.effect() : FAILURE;
    if (agent.x > agent.goal) return agent.moveLeft.condition() ? agent.moveLeft.effect() : FAILURE;
    return agent.moveRandom.condition() ? agent.moveRandom.effect() : FAILURE;
  }
}));
BehaviorTree.register('jump', new Task({
  run: agent => agent.jump.condition() ? agent.jump.effect() : FAILURE
}));
BehaviorTree.register('attack', new Task({
  run: agent => agent.attack.condition() ? agent.attack.effect() : FAILURE
}));
BehaviorTree.register('attack2', new Task({
  run: agent => agent.attack2.condition() ? agent.attack2.effect() : FAILURE
}));
BehaviorTree.register('attack3', new Task({
  run: agent => agent.attack3.condition() ? agent.attack3.effect() : FAILURE
}));
BehaviorTree.register('hasLowHealth', new Task({
  run: agent => agent.health / agent.maxHealth < .2 ? SUCCESS : FAILURE
}));
BehaviorTree.register('runAwayFromClosestEnemy', new Task({
  run: agent => agent.closestEnemy && agent.runAwayFrom.condition({ other: agent.closestEnemy })
    ? agent.runAwayFrom.effect({ other: agent.closestEnemy })
    : FAILURE
}));

BehaviorTree.register('moveToClosestEnemy', new Task({
  run: agent => agent.closestEnemy && agent.moveTo.condition({ other: agent.closestEnemy, distance: -1 })
    ? agent.moveTo.effect({ other: agent.closestEnemy, distance: -1 })
    : FAILURE
}));
BehaviorTree.register('moveToClosestFriend', new Task({
  run: agent => agent.closestFriend && agent.moveTo.condition({ other: agent.closestFriend, distance: -1 })
    ? agent.moveTo.effect({ other: agent.closestFriend, distance: -1 })
    : FAILURE
}));


BehaviorTree.register('follows', new Task({
  run: agent => agent.follow ? SUCCESS : FAILURE
}));
BehaviorTree.register('seesFriend', new Task({
  run: agent => agent.sensedFriends.length > 0 ? SUCCESS : FAILURE
}));
BehaviorTree.register('moveToFriend', new Task({
  run: agent => agent.closestFriend && agent.moveTo.condition({ other: agent.closestFriend, distance: 10 }) ? agent.moveTo.effect({ other: agent.closestFriend, distance: 10 }) : FAILURE
}));
BehaviorTree.register('goToFriend', new Sequence({
  nodes: [
    'follows',
    'seesFriend',
    new Selector({
      nodes: [
        'moveToFriend'
      ]
    })
  ]
}));

BehaviorTree.register('survive', new Sequence({
  nodes: [
    'hasLowHealth',
    'runAwayFromClosestEnemy'
 ]
}));

// Selector: runs until one node calls success
// Sequence: runs each node until fail
// Random: calls randomly, if running, will keep running
const tree = new Selector({
  nodes: [
    'moveRandom',
    'jump',
    'idle'
  ]
});

class Agent extends GameObject {
  constructor(id, options) {
    super(id, options);
    this.health = options.health ?? 5;
    this.maxHealth = 5;
    this.usd = options.usd ?? 0;
    this.status = options.status || 'idle';
    this.direction = options.direction || 'left';
    this.frame = options.frame || 0;
    this.walkingSpeed = options.walkingSpeed || 2;
    this.context = options.context || 'gameContext';
    this.senseRadius = 30;
    this.protection = 0;
    this.business = options.business || 1;
  }

  applyGravity = true;
  w = 16;
  h = 30;
  dmgs = [];
  heals = [];
  says = [];

  bTree = new BehaviorTree({
    tree,
    blackboard: this
  });

  idle = {
    condition: () => true,
    effect: () => {
      this.status = 'idle';
      return SUCCESS;
    }
  };
  moveLeft = {
    condition: () => true,
    effect: () => {
      this.direction = 'left';
      this.isMoving = 'left';
      const hasMoved = !moveObject(this, { x: -this.walkingSpeed, y: 0 }, CTDLGAME.quadTree);

      if (hasMoved) {
        this.status = 'move';
        return SUCCESS;
      }

      return FAILURE;
    }
  };
  moveRight = {
    condition: () => true,
    effect: () => {
      this.direction = 'right';
      this.isMoving = 'right';

      const hasMoved = !moveObject(this, { x: this.walkingSpeed , y: 0}, CTDLGAME.quadTree);
      if (hasMoved) {
        this.status = 'move';
        return SUCCESS;
      }

      return FAILURE;
    }
  };
  moveRandom = {
    condition: () => Math.random() < (this.activity || .01),
    effect: () => Math.random() < .5 ? this.moveLeft.effect() : this.moveRight.effect()
  };
  jump = {
    condition: () => this.canJump(),
    effect: () => {
      if (this.status !== 'jump') this.frame = 0;
      this.status = 'jump';
      if (this.frame !== 1) return RUNNING;
      this.vx = this.direction === 'right' ? 3 : -3;
      this.vy = -6;

      return SUCCESS;
    }
  };
  attack = {
    condition: () => {
      if (!this.closestEnemy) return false;

      if (!this.closestEnemy || !intersects(this.getBoundingBox(), this.closestEnemy.getBoundingBox())) return false; // not in biting distance

      return true;
    },
    effect: () => {
      if (this.status === 'attack' && this.frame === 3) {
        this.closestEnemy.hurt(this.strength || 1, this.direction === 'left' ? 'right' : 'left', this);
        return SUCCESS;
      }
      if (this.status === 'attack') return SUCCESS;

      this.frame = 0;
      this.status = 'attack';

      return SUCCESS;
    }
  };
  moveTo = {
    condition: ({ other }) => {
      const senseBox = this.getSenseBox();
      return other && intersects(senseBox, other.getBoundingBox());
    },
    effect: ({ other, distance }) => {
      const ducks = /duck/i.test(this.status);
      let action = ducks ? 'duck' : 'idle';

      if (this.getBoundingBox().x > other.getBoundingBox().x + other.getBoundingBox().w + distance) {
        action = ducks ? 'duckMoveLeft' : 'moveLeft';
      } else if (other.getBoundingBox().x > this.getBoundingBox().x + this.getBoundingBox().w + distance) {
        action = ducks ? 'duckMoveRight' : 'moveRight';
      }

      if (this[action].condition()) return this[action].effect();
      return FAILURE;
    }
  };
  lookAt = {
    condition: obj => obj,
    effect: obj => {
      this.direction = this.getCenter().x > obj.getCenter().x ? 'left' : 'right';
      return SUCCESS;
    }
  };
  runAwayFrom = {
    condition: ({ other }) => other && Math.abs(other.getCenter().x - this.getCenter().x) <= this.senseRadius,
    effect: ({ other }) => {
      let action = 'idle';

      if (this.getBoundingBox().x > other.getBoundingBox().x) {
        action = this['runRight'] ? 'runRight' : 'moveRight';
      } else if (other.getBoundingBox().x > this.getBoundingBox().x) {
        action = this['runLeft'] ? 'runLeft' : 'moveLeft';
      }
      if (this[action].condition()) return this[action].effect();
      return FAILURE;
    }
  };

  canJump = () => {
    if (this.hasShield || this.swims) return false;
    if (this.id === window.SELECTEDCHARACTER.id) return true;

    const jumpTo = this.getBoundingBox();
    jumpTo.y -= 6;
    jumpTo.x += this.direction === 'right' ? 3 : -3;

    if (window.DRAWSENSORS) {
      constants.overlayContext.fillStyle = 'red';
      constants.overlayContext.fillRect(jumpTo.x, jumpTo.y, jumpTo.w, jumpTo.h);
    }
    const obstacles = CTDLGAME.quadTree.query(jumpTo)
      .filter(obj => obj.isSolid && !obj.enemy && /Tile|Ramp|Boundary/.test(obj.getClass()))
      .filter(obj => intersects(obj, jumpTo));

    return obstacles.length === 0;
  };

  makeDamage = multiplier => {
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
        const dmg = Math.round(this.strength * (1 + Math.random() / 4));

        enemy.hurt(Math.round(dmg * multiplier), this.direction === 'left' ? 'right' : 'left', this);
      });
  };

  onHurt = () => {};
  onDie = () => {
    if (this.usd) {
      addTextToQueue(`${this.getClass()} got rekt,\nyou found $${this.usd}`);
    } else {
      addTextToQueue(`${this.getClass()} got rekt`);
    }
  };

  stun = direction => {
    this.status = 'hurt';
    this.vx = direction === 'left' ? 5 : -5;
    this.vy = -3;
  };

  hurtCondition = (dmg, direction) => !/spawn|hurt|rekt|block|burning|dive/.test(this.status) && !this.protection;
  hurt = (dmg, direction, agent) => {
    if (!this.hurtCondition(dmg, direction)) return;
    if (this.status === 'exhausted') dmg *= 4;
    this.dmgs.push({
      x: Math.round((Math.random() - .5) * 8),
      y: -8,
      dmg: Math.ceil(dmg)
    });
    this.health = Math.max(this.health - dmg, 0);
    this.status = 'hurt';
    this.vx = direction === 'left' ? 2 : -2;
    this.protection = 4;
    if (this.health <= 0) {
      this.health = 0;
      return this.die(agent);
    }

    return this.onHurt(agent);
  };

  heal = heal => {
    if (/rekt/.test(this.status)) return;
    const maxHeal = this.maxHealth - this.health;
    if (maxHeal < heal) heal = Math.floor(maxHeal);

    if (heal) {
      this.heals.push({
        x: Math.round((Math.random() - .5) * 8),
        y: -8, heal
      });
      this.health = Math.min(this.health + heal, this.maxHealth);
    }
    return heal > 0;
  };

  die = agent => {
    this.status = 'rekt';
    this.frame = 0;

    if (this.usd) CTDLGAME.inventory.usd += this.usd;
    if (this.item) {
      const item = new Item(
        this.item.id,
        {
          x: this.x,
          y: this.y,
          vy: -8,
          vx: Math.round((Math.random() - .5) * 10)
        }
      );
      CTDLGAME.objects.push(item);
    }

    return this.onDie(agent);
  };

  draw = () => {
    if (!canDrawOn(this.context)) return;
    if (!this.sprite && this.spriteId) this.sprite = CTDLGAME.assets[this.spriteId];
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

    const x = this.swims ? this.x + Math.round(Math.sin(CTDLGAME.frame / 16 + (this.strength || 1))) : this.x;
    constants[this.context].drawImage(
      this.sprite,
      data.x, data.y, this.w, this.h,
      x, this.y, this.w, this.h
    );
    constants[this.context].globalAlpha = 1;

    this.drawDmgs();
    this.drawHeals();
    this.drawSays();
  };

  drawDmgs = () => {
    if (!this.dmgs) return;
    this.dmgs = this.dmgs
      .filter(dmg => dmg.y > -24)
      .map(dmg => {
        const dmgText = this.maxHealth ? `-${Math.round(dmg.dmg / this.maxHealth * 1000) / 10}%` : `-${dmg.dmg}`;
        write(constants.charContext, dmgText, {
          x: this.getCenter().x - 24 + dmg.x,
          y: this.y + dmg.y,
          w: 48
        }, 'center', false, 8, true, '#F00');
        dmg.y--;
        return dmg;
      });
  };
  drawHeals = () => {
    if (!this.heals) return;
    this.heals = this.heals
      .filter(heal => heal.y > -24)
      .map(heal => {
        const healText = this.maxHealth ? `+${Math.round(heal.heal / this.maxHealth * 1000) / 10}%` : `+${heal.heal}`;
        write(constants.charContext, healText, {
          x: this.getCenter().x - 24 + heal.x,
          y: this.y + heal.y,
          w: 48
        }, 'center', false, 8, true, '#0F0');

        heal.y--;
        return heal;
      });
  };

  say = say => {
    this.says = [{y: -8, say}];
  };

  drawSays = () => {
    if (!this.says) return;
    this.says = this.says
      .filter(say => say.y > -24)
      .map(say => {
        write(constants.charContext, say.say, {
          x: this.getCenter().x - 50,
          y: this.y + say.y,
          w: 100
        }, 'center', false, 20, false, '#FFF');
        return {
          ...say,
          y: say.y - 1
        };
      });
  };

  applyPhysics = () => {
    if ((this.vx !== 0 || this.vy !== 0) && this.inViewport) {
      if (this.vx > 12) this.vx = 12;
      if (this.vx < -12) this.vx = -12;
      if (this.vy > 12) this.vy = 12;
      if (this.vy < -12) this.vy = -12;

      let hasCollided = false;
      if (this.context === 'fgContext') {
        this.x += this.vx;
        this.y += this.vy;
      } else {
        hasCollided = moveObject(this, { x: this.vx , y: this.vy }, CTDLGAME.quadTree);
      }

      if (!hasCollided && !/jump|rekt|hurt|burning/.test(this.status) && Math.abs(this.vy) > 5) {
        this.status = 'fall';
      }

      if (this.vx < 0) this.vx += 1;
      if (this.vx > 0) this.vx -= 1;
    }

    if (this.status === 'fall' && Math.abs(this.vy) <= 6) {
      this.status = 'idle';
    }
  };

  getSenseBox = () => ({
    id: this.id,
    x: this.x - this.senseRadius,
    y: this.y - this.senseRadius / 4,
    w: this.w + this.senseRadius * 2,
    h: this.h + this.senseRadius / 2
  });

  getAnchor = () => ({
      x: this.getBoundingBox().x + 2,
      y: this.getBoundingBox().y + this.getBoundingBox().h - 1,
      w: this.getBoundingBox().w - 5,
      h: 1
  });

  toJSON = this._toJSON;
}

export default Agent;