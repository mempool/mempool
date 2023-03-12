import { BehaviorTree, Selector, Sequence, Task, SUCCESS, FAILURE } from 'behaviortree';

import citizenSpriteData from '../sprites/citizen';
import { CTDLGAME } from '../gameUtils';
import { moveObject, intersects, getClosest } from '../geometryUtils';
import constants from '../constants';
import { addTextToQueue } from '../textUtils';
import Human from './Human';
import { random } from '../arrayUtils';

const sprites = [
  'citizen1',
  'citizen2',
  'citizen3',
  'citizen4',
  'citizen5'
];

const touchesEnemy = new Task({
  run: agent => {
    if (!agent.closestEnemy) return FAILURE;
    const attackBox = {
      x: agent.getBoundingBox().x - agent.attackRange,
      y: agent.getBoundingBox().y,
      w: agent.getBoundingBox().w + agent.attackRange * 2,
      h: agent.getBoundingBox().h
    };
    return intersects(attackBox, agent.closestEnemy.getBoundingBox()) ? SUCCESS : FAILURE;
  }
});
const isUnhappy = new Task({
  run: agent => agent.isUnhappy ? SUCCESS : FAILURE
});
const isProtestLeader = new Task({
  run: agent => agent.id === 'protest-leader' ? SUCCESS : FAILURE
});
const talk = new Task({
  run: agent => {
    agent.status = 'attack';
    return SUCCESS;
  }
});

// Selector: runs until one node calls success
const regularBehaviour = new Selector({
  nodes: [
    isUnhappy,
    'moveToPointX',
    'idle'
  ]
});

// Sequence: runs each node until fail
const protest = new Sequence({
  nodes: [
    isUnhappy,
    'lookAtEnemy',
    touchesEnemy,
    'attack'
  ]
});
// Sequence: runs each node until fail
const leadProtest = new Sequence({
  nodes: [
    isUnhappy,
    isProtestLeader,
    talk
  ]
});

// only "protest while condition is met otherwise just walk around
const tree = new Selector({
  nodes: [
    'survive',
    leadProtest,
    protest,
    regularBehaviour
  ]
});

class Citizen extends Human {
  constructor(id, options) {
    super(id, options);
    this.spriteId = options.spriteId || random(sprites);
    this.spriteData = citizenSpriteData;
    this.maxHealth = options.maxHealth ?? Math.round(Math.random() * 5) + 5;
    this.health = options.health ?? this.maxHealth;
    this.strength = 1;
    this.context = options.context || (Math.random() < .5 ? 'bgContext' : 'charContext');
    this.attackRange = options.attackRange ?? Math.ceil(Math.random() * 70) + 70;
    this.hasSign = options.hasSign ?? Math.random() < .1;
    this.films = options.films ?? Math.random() < .1;
    this.senseRadius = this.attackRange;
    this.applyGravity = options.applyGravity ?? true;
    this.walkingSpeed = options.walkingSpeed || 3;
    this.runningSpeed = options.runningSpeed || Math.round(Math.random() * 2) + 4;
    this.isUnhappy = options.isUnhappy;
    this.protection = 0;
  }

  w = 16;
  h = 30;


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

  attack = {
    condition: () => {
      return SUCCESS;
    },
    effect: () => {
      this.status = this.hasSign
        ? 'hold'
        : this.films
        ? 'action'
        : 'attack';

      return SUCCESS;
    }
  };

  stun = direction => {
    this.status = 'hurt';
    this.vx = direction === 'left' ? 5 : -5;
    this.vy = -3;
  };

  die = () => {
    this.status = 'rekt';
    this.health = 0;
    this.removeTimer = 64;

    addTextToQueue(`Citizen got rekt`);
  };

  update = () => {
    if (CTDLGAME.lockCharacters) {

      this.draw();
      return;
    }

    this.applyPhysics();
    if (this.status === 'fall') this.status = 'hurt';

    if (this.status === 'hurt' && this.vx === 0 && this.vy === 0) {
      this.status = 'idle';
    }

    const senseBox = this.getSenseBox();
    this.sensedObjects = CTDLGAME.quadTree.query(senseBox);

    this.touchedObjects = CTDLGAME.quadTree
      .query(this.getBoundingBox())
      .filter(obj => intersects(this.getBoundingBox(), obj.getBoundingBox()));

    // enter doors
    if (this.touchedObjects.length > 0 && Math.random() < 0.075 &&
      this.touchedObjects.some(obj => /door/.test(obj.id))) {
      this.remove = true;
    }
    // out of frame out of mind
    if (!this.isUnhappy && Math.random() < 0.075 && !intersects(CTDLGAME.viewport, this.getBoundingBox())) {
      this.remove = true;
    }

    if (window.DRAWSENSORS) {
      constants.charContext.beginPath();
      constants.charContext.rect(senseBox.x, senseBox.y, senseBox.w, senseBox.h);
      constants.charContext.stroke();
    }

    if (this.isUnhappy) {
      this.sensedEnemies = this.sensedObjects
        .filter(enemy => enemy.getClass() === 'PoliceForce')
        .filter(enemy => Math.abs(enemy.getCenter().x - this.getCenter().x) <= this.senseRadius);
    } else {
      this.sensedEnemies = this.sensedObjects
        .filter(enemy => enemy.enemy && enemy.health && enemy.health > 0)
        .filter(enemy => Math.abs(enemy.getCenter().x - this.getCenter().x) <= this.senseRadius);
    }

    this.sensedFriends = this.sensedObjects
      .filter(friend => /Character|Human/.test(friend.getClass()) && friend.id !== this.id && friend.status !== 'rekt')
      .filter(friend => Math.abs(friend.getCenter().x - this.getCenter().x) <= this.senseRadius);

    if (Math.abs(this.vy) < 3 && !/fall|rekt|hurt/.test(this.status)) {
      this.closestEnemy = getClosest(this, this.sensedEnemies);
      this.closestFriend = getClosest(this, this.sensedFriends);
      this.bTree.step();
    }

    if (/attack/i.test(this.status)) {
      if ((CTDLGAME.frame + this.delay) % this.speed === 0) {
        this.frame++;
      }
    } else if (this.status !== 'idle' || Math.random() < .05) {
      this.frame++;
    }

    if (this.frame >= this.spriteData[this.direction][this.status].length) {
      this.frame = 0;
      if (/action/.test(this.status)) this.status = 'idle';
    }

    if (this.removeTimer) this.removeTimer--;
    if (this.removeTimer === 0) this.remove = true;

    this.draw();
  };

  thingsToSay = [
    ['Citizen:\n...cheesy vagina...'],
    ['Citizen:\nYo stupid malaka!'],
    ['Citizen:\nwtf..., like actually wtf'],
    ['Citizen:\n7.7% are mentally\nchallenged...'],
    ['Citizen:\nDamn, they asked to call\nthem back, we should do it'],
    ['Citizen:\nJesus, WHAT ELSE ARE THEY\nGONNA THROW AT US!'],
    ['Citizen:\nMaybe we don\'t go shoppin after all?'],
    ['Citizen:\nIt\'s super small btw...'],
    ['Citizen:\nStarts with a six ends with a point one five.'],
    ['Citizen:\nOf course they were fucked, lol'],
    ['Citizen:\nI love how religions "know"\nanything that\'s right\nor wrong.'],
    ['Citizen:\nDamn son.'],
    ['Citizen:\n...Pouring pints of orange Guinness for some dry shites who just kept saying...'],
    ['Citizen:\nSi no me crees o no lo\nentiendes, no tengo tiempo para tratar de convencerte...'],
    ['Citizen:\nA truck made for\nfuuuuuuuckkkkkinggg...'],
    ['Citizen:\nI smell like rust.'],
    ['Citizen:\nWould you rather... Pee on a bum or be peed on\nby a bum?'],
    ['Citizen:\nMaybe smells funny at my\nplace...'],
    ['Citizen:\nI\'m so tired'],
    ['Citizen:\n...and unfortunately no sex...']
  ];

  touchEvent = () => {
    if (this.talks || Math.random() > .001) return;
    this.talks = true;

    const whatToSay = random(this.thingsToSay);
    whatToSay.map((text, index) => {
      if (index === whatToSay.length - 1) {
        addTextToQueue(text, () => {
          this.talks = false;
        });
      } else {
        addTextToQueue(text);
      }
    });
  };


  getBoundingBox = () =>this.status !== 'rekt'
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
}
export default Citizen;