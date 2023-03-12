const w = 14;
const h = 20;

export default {
  right: {
    idle: [
      { x: 0 * w, y: 0 * h, w, h }
    ],
    move: [
      { x: 1 * w, y: 0 * h, w, h },
      { x: 2 * w, y: 0 * h, w, h },
      { x: 3 * w, y: 0 * h, w, h },
      { x: 4 * w, y: 0 * h, w, h }
    ],
    jump: [
      { x: 0 * w, y: 1 * h, w, h }
    ],
    fall: [
      { x: 0 * w, y: 1 * h, w, h }
    ]
  },
  left: {
    idle: [
      { x: (5 + 0) * w, y: 0 * h, w, h }
    ],
    move: [
      { x: (5 + 1) * w, y: 0 * h, w, h },
      { x: (5 + 2) * w, y: 0 * h, w, h },
      { x: (5 + 3) * w, y: 0 * h, w, h },
      { x: (5 + 4) * w, y: 0 * h, w, h }
    ],
    jump: [
      { x: (5 + 0) * w, y: 1 * h, w, h }
    ],
    fall: [
      { x: (5 + 0) * w, y: 1 * h, w, h }
    ]
  }
};