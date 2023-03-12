import { BehaviorTree, Selector, Task, SUCCESS, FAILURE } from 'behaviortree';

import { CTDLGAME } from '../gameUtils';
import { intersects } from '../geometryUtils';
import spriteData from '../sprites/soulexBoy';
import Agent from '../Agent';
import { Boundary } from '../geometryUtils/makeBoundary';
import { random } from '../arrayUtils';
import { addTextToQueue } from '../textUtils';

const jump = new Task({
  run: agent => agent.strategy === 'jump' ? agent.jump.effect() : FAILURE
});
const moveRight = new Task({
  run: agent => agent.strategy === 'moveRight' ? agent.moveRight.effect() : FAILURE
});
const moveLeft = new Task({
  run: agent => agent.strategy === 'moveLeft' ? agent.moveLeft.effect() : FAILURE
});
const moveLeftAndJump = new Task({
  run: agent => {
    if (agent.strategy !== 'moveLeftAndJump') return FAILURE;
    agent.direction = 'left';
    return agent.jump.effect();
  }
});
const moveRandomAndJump = new Task({
  run: agent => {
    if (!CTDLGAME.mempool || CTDLGAME.mempool.vsize < 40000000) return FAILURE;
    if (agent.strategy !== 'moveRandomAndJump' || agent.sensedFriends.length === 0 || Math.random() < .95) return FAILURE;
    agent.direction = Math.random() < .5 ? 'right' : 'left';
    return agent.jump.effect();
  }
});

const tree = new Selector({
  nodes: [
    jump,
    moveRight,
    moveLeft,
    moveLeftAndJump,
    moveRandomAndJump,
    'idle'
  ]
});

class SoulexBoy extends Agent {
  constructor(id, options) {
    super(id, options);
    this.spriteData = spriteData;
    this.spriteId = 'soulexBoy';
    this.strategy = options.strategy || 'moveRight';
    this.senseRadius = 32;
    this.swims = options.swims;
    this.walkingSpeed = 3;
    this.thingsToSaySelect = [['SoulexBoy:\nEvery day is a great day!']];
    this.checkpoints = [
      new Boundary({
        id: 'moveRandomAndJump',
        x: 26 * 8,
        y: 20 * 8,
        w: 8,
        h: 24
      }),
      new Boundary({
        id: 'moveRight',
        x: 176,
        y: 221,
        w: 24 * 3,
        h: 24
      }),
      new Boundary({
        id: 'jump',
        x: 500,
        y: 195,
        w: 10,
        h: 24
      }),
      new Boundary({
        id: 'moveRight',
        x: 511,
        y: 197,
        w: 10,
        h: 24
      }),
      new Boundary({
        id: 'moveLeftAndJump',
        x: 553,
        y: 166,
        w: 24,
        h: 24
      }),
      new Boundary({
        id: 'moveLeft',
        x: 523,
        y: 170,
        w: 24,
        h: 10
      })
    ];
  }

  w = 14;
  h = 20;
  applyGravity = true;

  bTree = new BehaviorTree({
    tree,
    blackboard: this
  });

  jump = {
    condition: () => this.canJump(),
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
  update = () => {
    this.applyPhysics();

    const checkpoint = this.checkpoints
      .find(checkpoint => intersects(this.getBoundingBox(), checkpoint.getBoundingBox()));

    if (checkpoint) {
      this.strategy = JSON.parse(checkpoint.id).id;
      if (this.strategy !== 'jump') this.status = 'idle';
    }

    this.sensedFriends = CTDLGAME.quadTree.query({
      id: this.id,
      x: this.x - this.senseRadius,
      y: this.y - this.senseRadius,
      w: this.w + this.senseRadius * 2,
      h: this.h + this.senseRadius * 2
    })
      .filter(friend => friend.getClass() === 'Character' && friend.status !== 'rekt')
      .filter(friend => Math.abs(friend.getCenter().x - this.getCenter().x) <= this.senseRadius);

    if (Math.abs(this.vy) < 3 && !/jump|fall/.test(this.status)) {
      this.bTree.step();
    } else {
      // this.idle.effect()
    }

    this.frame++;
    this.draw();
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

  touchEvent = () => {
    if (this.touched) return;
    this.touched = true;
    if (CTDLGAME.mempool && CTDLGAME.mempool.vsize < 40000000) {
      addTextToQueue('SoulexBoy:\nThe mempool is almost\nempty...', () => {
        this.touched = false;
      });
    }
  };

  applyGravity = false;
}
export default SoulexBoy;