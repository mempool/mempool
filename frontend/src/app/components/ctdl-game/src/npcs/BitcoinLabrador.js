import { BehaviorTree, Sequence, Selector, Task, SUCCESS, FAILURE } from 'behaviortree';

import spriteData from '../sprites/bitcoinLabrador';
import { CTDLGAME } from '../gameUtils';
import { moveObject, intersects, getClosest } from '../geometryUtils';
import constants from '../constants';
import Agent from '../Agent';
import { playSound } from '../sounds';

const exhausted = new Task({
  run: agent => {
    if (agent.exhaustion > 10) agent.exhausted = true;
    if (!agent.exhausted) return FAILURE;
    agent.status = 'exhausted';
    agent.exhaustion--;
    if (agent.exhaustion <= 0) agent.exhausted = false;
    return SUCCESS;
  }
});
const bark = new Task({
  run: agent => agent.bark.condition() ? agent.bark.effect() : FAILURE
});
const moveToFriend = new Task({
  run: agent => {
    if (!agent.closestFriend || agent.goal || Math.random() < .90) return FAILURE;
    if (Math.abs(agent.closestFriend.getCenter().x - agent.getCenter().x) < 10) return FAILURE;
    agent.status = Math.random() < .5 ? 'move' : 'run';
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
    if (Math.abs(agent.x - agent.goal) < 15) agent.goal = null;
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
    if (Math.abs(agent.x - agent.goal) < 20) agent.goal = null;
    if (!agent.goal || agent.status !== 'run') return FAILURE;
    if (agent.x < agent.goal) return agent.runRight.condition() ? agent.runRight.effect() : FAILURE;
    if (agent.x > agent.goal) return agent.runLeft.condition() ? agent.runLeft.effect() : FAILURE;
  }
});
const runToClosestEnemy = new Task({
  run: agent => agent.closestEnemy && agent.runTo.condition({ other: agent.closestEnemy, distance: -1 })
    ? agent.runTo.effect({ other: agent.closestEnemy, distance: -1 })
    : FAILURE
});


// Sequence: runs each node until fail
const attackEnemy = new Sequence({
  nodes: [
    'lookAtEnemy',
    'canAttackEnemy',
    'attack'
  ]
});

// Selector: runs until one node calls success
const goToEnemy = new Sequence({
  nodes: [
    'seesEnemy',
    'doesNotTouchEnemy',
    runToClosestEnemy
  ]
});

// Selector: runs until one node calls success
const regularBehaviour = new Selector({
  nodes: [
    bark,
    attackEnemy,
    goToEnemy,
    moveToFriend,
    moveToPointX,
    runToPointX,
    'idle'
  ]
});


const tree = new Selector({
  nodes: [
    'survive',
    exhausted,
    regularBehaviour
  ]
});

class BitcoinLabrador extends Agent {
  constructor(id, options) {
    super(id, options);
    this.spriteId = 'bitcoinLabrador';
    this.spriteData = spriteData;
    this.maxHealth = options.maxHealth ?? Math.round(Math.random() * 5) + 5;
    this.health = options.health ?? this.maxHealth;
    this.strength = 4;
    this.exhaustion = options.exhaustion || 0;
    this.exhausted = options.exhausted;
    this.status = options.status || 'idle';
    this.attackRange = 2;
    this.senseRadius = 40;
    this.walkingSpeed = options.walkingSpeed || 2;
    this.runningSpeed = options.runningSpeed || 6;
    this.protection = 0;
    this.follow = options.follow;

    this.goal = options.goal;
    if (!this.goal && Math.random() < .5 && CTDLGAME.world) this.goal = Math.round(Math.random() * CTDLGAME.world.w);

    CTDLGAME.bitcoinLabrador = this;
  }

  w = 25;
  h = 14;
  applyGravity = true;

  bTree = new BehaviorTree({
    tree,
    blackboard: this
  });

  idle = {
    condition: () => true,
    effect: () => {
      this.status = 'idle';
      this.exhaustion -= .5;
      return SUCCESS;
    }
  };
  runLeft = {
    condition: () => true,
    effect: () => {
      this.direction = 'left';
      this.isMoving = 'left';
      const hasMoved = !moveObject(this, { x: -this.runningSpeed, y: 0 }, CTDLGAME.quadTree);

      if (hasMoved) {
        this.status = 'run';
        this.exhaustion++;

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
        this.exhaustion++;
        return SUCCESS;
      }

      return FAILURE;
    }
  };

  runTo = {
    condition: ({ other }) => other && Math.abs(other.getCenter().x - this.getCenter().x) <= this.senseRadius,
    effect: ({ other, distance }) => {
      let action = 'idle';

      if (this.getBoundingBox().x > other.getBoundingBox().x + other.getBoundingBox().w + distance) {
        action = 'runLeft';
      } else if (other.getBoundingBox().x > this.getBoundingBox().x + this.getBoundingBox().w + distance) {
        action = 'runRight';
      }
      if (this[action].condition()) return this[action].effect();
      return FAILURE;
    }
  };

  bark = {
    condition: () => (this.status === 'bark' && this.frame < 5)
    || (this.closestEnemy && Math.random() < .1)
    || Math.random() < .005,
    effect: () => {
      this.status = 'bark';

      if (this.frame === 3) {
        playSound('bark');
        this.say('woef');
      }
      return SUCCESS;
    }
  };

  attack = {
    condition: () => {
      if (!this.closestEnemy) return FAILURE;

      if (!this.closestEnemy || !intersects(this.getBoundingBox(), this.closestEnemy.getBoundingBox())) return FAILURE; // not in biting distance

      return SUCCESS;
    },
    effect: () => {
      if (this.status === 'attack' && this.frame === 3) {
        this.closestEnemy.hurt(this.strength, this.direction === 'left' ? 'right' : 'left', this);
        return SUCCESS;
      }
      if (this.status === 'attack') return SUCCESS;

      this.exhaustion += 2;
      this.frame = 0;
      this.status = 'attack';

      return SUCCESS;
    }
  };

  update = () => {
    if (CTDLGAME.lockCharacters) {

      this.draw();
      return;
    }

    this.applyPhysics();
    if (this.status === 'fall') this.status = 'run';

    this.exhaustion = Math.max(0, this.exhaustion);

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
      .filter(friend => /Character/.test(friend.getClass()) && friend.id !== this.id && friend.status !== 'rekt')
      .filter(friend => Math.abs(friend.getCenter().x - this.getCenter().x) <= this.senseRadius);

    if (Math.abs(this.vy) < 3 && !/fall/.test(this.status)) {
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
  };
}
export default BitcoinLabrador;