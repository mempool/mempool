import { BehaviorTree, Selector } from 'behaviortree';

import spriteData from '../sprites/wiz';
import { CTDLGAME } from '../gameUtils';
import constants from '../constants';
import { addTextToQueue } from '../textUtils';
import Agent from '../Agent';
import { random } from '../arrayUtils';


// Selector: runs until one node calls success
const regularBehaviour = new Selector({
  nodes: [
    'moveToPointX',
    'idle'
  ]
});

const tree = new Selector({
  nodes: [
    regularBehaviour
  ]
});

class Wiz extends Agent {
  constructor(id, options) {
    super(id, options);
    this.spriteData = spriteData;
    this.context = options.context || (Math.random() < .5 ? 'bgContext' : 'charContext');
    this.walkingSpeed = options.walkingSpeed || 3;
    this.runningSpeed = options.runningSpeed || Math.round(Math.random() * 2) + 4;
    this.protection = 0;
    this.thingsToSay = options.thingsToSay;

    this.delay = Math.round(Math.random() * 2) * constants.FRAMERATE;
    this.speed = Math.round(Math.random() * 3) * constants.FRAMERATE;
    this.goal = options.goal;
    if (!this.goal && Math.random() < .5 && CTDLGAME.world) this.goal = Math.round(Math.random() * CTDLGAME.world.w);
  }

  spriteId = 'wiz';
  strength = 1;
  applyGravity = true;
  w = 16;
  h = 30;


  bTree = new BehaviorTree({
    tree,
    blackboard: this
  });

  update = () => {
    if (CTDLGAME.lockCharacters) {
      this.draw();
      return;
    }

    this.applyPhysics();
    if (this.status === 'fall') this.status = 'idle';


    if (Math.abs(this.vy) < 3 && !/fall|rekt|hurt/.test(this.status)) {
      this.bTree.step();
    }

    if (this.status !== 'idle' || Math.random() < .05) {
      this.frame++;
    }

    this.draw();
  };

  select = () => {
    if (!this.thingsToSay || this.isSelected) return;
    this.isSelected = true;

    const whatToSay = random(this.thingsToSay);
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

  getBoundingBox = () => ({
      id: this.id,
      x: this.x + 6,
      y: this.y + 6,
      w: this.w - 12,
      h: this.h - 6
    });
}
export default Wiz;