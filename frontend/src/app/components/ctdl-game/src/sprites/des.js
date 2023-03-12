const w = 13;
const h = 30;
const set = [0, 1, 2, 3, 4, 4, 3, 2, 1, 0];
export default {
  left: {
    idle: set
      .concat(set)
      .concat(set)
      .concat(set)
      .concat(set)
      .map((frame, i) => ({ x: frame * w, y: (i / set.length < 1 ? 30 : 0), w, h }))
  }
};