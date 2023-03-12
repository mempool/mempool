const w = 25;
const h = 14;

export default {
  right: {
    idle: [
      { x: 0 * w, y: 0 * h, w, h }
    ],
    exhausted: [
      { x: 1 * w, y: 0 * h, w, h }
    ],
    stand: [
      { x: 2 * w, y: 0 * h, w, h }
    ],
    bark: [
      { x: 2 * w, y: 0 * h, w, h },
      { x: 2 * w, y: 0 * h, w, h },
      { x: 2 * w, y: 0 * h, w, h },
      { x: 3 * w, y: 0 * h, w, h },
      { x: 3 * w, y: 0 * h, w, h },
      { x: 3 * w, y: 0 * h, w, h },
    ],
    move: [
      { x: 0 * w, y: 1 * h, w, h },
      { x: 1 * w, y: 1 * h, w, h },
      { x: 2 * w, y: 1 * h, w, h },
      { x: 3 * w, y: 1 * h, w, h },
      { x: 0 * w, y: 2 * h, w, h },
      { x: 1 * w, y: 2 * h, w, h },
      { x: 2 * w, y: 2 * h, w, h },
      { x: 3 * w, y: 2 * h, w, h },
    ],
    run: [
      { x: 0 * w, y: 3 * h, w, h },
      { x: 1 * w, y: 3 * h, w, h },
      { x: 2 * w, y: 3 * h, w, h },
      { x: 3 * w, y: 3 * h, w, h },
      { x: 0 * w, y: 4 * h, w, h },
      { x: 1 * w, y: 4 * h, w, h },
      { x: 2 * w, y: 4 * h, w, h },
    ],
    attack: [
      { x: 0 * w, y: 5 * h, w, h },
      { x: 1 * w, y: 5 * h, w, h },
      { x: 1 * w, y: 5 * h, w, h },
      { x: 1 * w, y: 5 * h, w, h }
    ]
  },
  left: {
    idle: [
      { x: (4 + 0) * w, y: 0 * h, w, h }
    ],
    exhausted: [
      { x: (4 + 1) * w, y: 0 * h, w, h }
    ],
    stand: [
      { x: (4 + 2) * w, y: 0 * h, w, h }
    ],
    bark: [
      { x: (4 + 2) * w, y: 0 * h, w, h },
      { x: (4 + 2) * w, y: 0 * h, w, h },
      { x: (4 + 2) * w, y: 0 * h, w, h },
      { x: (4 + 3) * w, y: 0 * h, w, h },
      { x: (4 + 3) * w, y: 0 * h, w, h },
      { x: (4 + 3) * w, y: 0 * h, w, h },
    ],
    move: [
      { x: (4 + 0) * w, y: 1 * h, w, h },
      { x: (4 + 1) * w, y: 1 * h, w, h },
      { x: (4 + 2) * w, y: 1 * h, w, h },
      { x: (4 + 3) * w, y: 1 * h, w, h },
      { x: (4 + 0) * w, y: 2 * h, w, h },
      { x: (4 + 1) * w, y: 2 * h, w, h },
      { x: (4 + 2) * w, y: 2 * h, w, h },
      { x: (4 + 3) * w, y: 2 * h, w, h },
    ],
    run: [
      { x: (4 + 0) * w, y: 3 * h, w, h },
      { x: (4 + 1) * w, y: 3 * h, w, h },
      { x: (4 + 2) * w, y: 3 * h, w, h },
      { x: (4 + 3) * w, y: 3 * h, w, h },
      { x: (4 + 0) * w, y: 4 * h, w, h },
      { x: (4 + 1) * w, y: 4 * h, w, h },
      { x: (4 + 2) * w, y: 4 * h, w, h },
    ],
    attack: [
      { x: (4 + 0) * w, y: 5 * h, w, h },
      { x: (4 + 1) * w, y: 5 * h, w, h },
      { x: (4 + 1) * w, y: 5 * h, w, h },
      { x: (4 + 1) * w, y: 5 * h, w, h }
    ]
  }
};