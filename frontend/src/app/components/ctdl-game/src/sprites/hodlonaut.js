const w = 20;
const h = 30;

export default {
  right: {
    idle: [
      { x: 0 * w, y: 0 * h, w, h},
      { x: 0 * w, y: 3 * h, w, h}
    ],
    duck: [
      { x: 2 * w, y: 5 * h, w, h}
    ],
    back: [
      { x: 2 * w, y: 3 * h, w, h}
    ],
    move: [
      { x: 2 * w, y: 0 * h, w, h},
      { x: 3 * w, y: 0 * h, w, h},
      { x: 4 * w, y: 0 * h, w, h},
      { x: 5 * w, y: 0 * h, w, h}
    ],
    duckMove: [
      { x: 2 * w, y: 5 * h, w, h},
      { x: 3 * w, y: 5 * h, w, h},
      { x: 4 * w, y: 5 * h, w, h},
      { x: 5 * w, y: 5 * h, w, h}
    ],
    jump: [
      { x: 0 * w, y: 2 * h, w, h},
      { x: 1 * w, y: 2 * h, w, h},
      { x: 2 * w, y: 2 * h, w, h},
      { x: 3 * w, y: 2 * h, w, h},
      { x: 4 * w, y: 2 * h, w, h},
      { x: 5 * w, y: 2 * h, w, h}
    ],
    fall: [
      { x: 1 * w, y: 3 * h, w, h}
    ],
    hurt: [
      { x: 1 * w, y: 3 * h, w, h}
    ],
    stun: [
      { x: 1 * w, y: 3 * h, w, h}
    ],
    rekt: [
      { x: 3 * w, y: 110, w: 25, h: 10}
    ],
    action: [
      { x: 0 * w, y: 4 * h, w, h},
      { x: 1 * w, y: 4 * h, w, h},
      { x: 2 * w, y: 4 * h, w, h},
      { x: 3 * w, y: 4 * h, w, h},
      { x: 4 * w, y: 4 * h, w, h}
    ],
    attack: [
      { x: 5 * w, y: 3 * h, w, h},
      { x: 5 * w, y: 4 * h, w, h}
    ],
    moveAttack: [
      { x: 2 * w, y: 1 * h, w, h},
      { x: 3 * w, y: 1 * h, w, h},
      { x: 4 * w, y: 1 * h, w, h},
      { x: 5 * w, y: 1 * h, w, h}
    ],
    duckMoveAttack: [
      { x: 2 * w, y: 6 * h, w, h},
      { x: 3 * w, y: 6 * h, w, h},
      { x: 4 * w, y: 6 * h, w, h},
      { x: 5 * w, y: 6 * h, w, h}
    ],
    duckAttack: [
      { x: 1 * w, y: 6 * h, w, h},
      { x: 2 * w, y: 6 * h, w, h}
    ]
  },
  left: {
    idle: [
      { x: (6 + 0) * w, y: 0 * h, w, h},
      { x: (6 + 0) * w, y: 3 * h, w, h}
    ],
    duck: [
      { x: (6 + 2) * w, y: 5 * h, w, h}
    ],
    back: [
      { x: (6 + 2) * w, y: 3 * h, w, h}
    ],
    move: [
      { x: (6 + 2) * w, y: 0 * h, w, h},
      { x: (6 + 3) * w, y: 0 * h, w, h},
      { x: (6 + 4) * w, y: 0 * h, w, h},
      { x: (6 + 5) * w, y: 0 * h, w, h}
    ],
    duckMove: [
      { x: (6 + 2) * w, y: 5 * h, w, h},
      { x: (6 + 3) * w, y: 5 * h, w, h},
      { x: (6 + 4) * w, y: 5 * h, w, h},
      { x: (6 + 5) * w, y: 5 * h, w, h}
    ],
    jump: [
      { x: (6 + 0) * w + 0, y: 2 * h, w, h},
      { x: (6 + 1) * w, y: 2 * h, w, h},
      { x: (6 + 2) * w, y: 2 * h, w, h},
      { x: (6 + 3) * w, y: 2 * h, w, h},
      { x: (6 + 4) * w, y: 2 * h, w, h},
      { x: (6 + 5) * w, y: 2 * h, w, h}
    ],
    fall: [
      { x: (6 + 1) * w, y: 3 * h, w, h}
    ],
    hurt: [
      { x: (6 + 1) * w, y: 3 * h, w, h}
    ],
    stun: [
      { x: (6 + 1) * w, y: 3 * h, w, h}
    ],
    rekt: [
      { x: 3 * w, y: 110, w: 25, h: 10}
    ],
    action: [
      { x: (6 + 0) * w + 0, y: 4 * h, w, h},
      { x: (6 + 1) * w, y: 4 * h, w, h},
      { x: (6 + 2) * w, y: 4 * h, w, h},
      { x: (6 + 3) * w, y: 4 * h, w, h},
      { x: (6 + 4) * w, y: 4 * h, w, h}
    ],
    attack: [
      { x: (6 + 5) * w, y: 3 * h, w, h},
      { x: (6 + 5) * w, y: 4 * h, w, h}
    ],
    moveAttack: [
      { x: (6 + 2) * w, y: 1 * h, w, h},
      { x: (6 + 3) * w, y: 1 * h, w, h},
      { x: (6 + 4) * w, y: 1 * h, w, h},
      { x: (6 + 5) * w, y: 1 * h, w, h}
    ],
    duckMoveAttack: [
      { x: (6 + 2) * w, y: 6 * h, w, h},
      { x: (6 + 3) * w, y: 6 * h, w, h},
      { x: (6 + 4) * w, y: 6 * h, w, h},
      { x: (6 + 5) * w, y: 6 * h, w, h}
    ],
    duckAttack: [
      { x: (6 + 1) * w, y: 6 * h, w, h},
      { x: (6 + 2) * w, y: 6 * h, w, h}
    ]
  }
};