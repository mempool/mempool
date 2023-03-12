import constants from '../constants';
import { write } from '../font';
import { hexToHsl } from '../stringUtils';
import { CTDLGAME } from './CTDLGAME';

const progressBar = {
  x: 20,
  y: constants.HEIGHT / 2 - 20,
  w: constants.WIDTH - 40,
  h: 20
};

const colors = {
  mined: {
    body: [
      hexToHsl('#8b3bef'),
      hexToHsl('#7345e1'),
      hexToHsl('#524ed1'),
      hexToHsl('#524ed1'),
      hexToHsl('#3e56c3'),
      hexToHsl('#1b5eb4')
    ],
    sides: [
      hexToHsl('#232838'),
      hexToHsl('#191d27')
    ]
  },
  queued: {
    body: [
      hexToHsl('#bb6520'),
      hexToHsl('#bb6520'),
      hexToHsl('#bd6c1d'),
      hexToHsl('#bd6c1d'),
      hexToHsl('#bf7319'),
      hexToHsl('#bf7319')
    ],
    sides: [
      hexToHsl('#3f3733'),
      hexToHsl('#302b2c')
    ]
  }
};

const renderLine = () => {
  constants.menuContext.strokeStyle = '#dfe0e0';
  constants.menuContext.beginPath();
  constants.menuContext.setLineDash([2, 2]);
  constants.menuContext.moveTo(CTDLGAME.viewport.x + constants.WIDTH / 2 - .5, CTDLGAME.viewport.y + constants.HEIGHT / 2 - 16);
  constants.menuContext.lineTo(CTDLGAME.viewport.x + constants.WIDTH / 2 - .5, CTDLGAME.viewport.y + constants.HEIGHT / 2);
  constants.menuContext.stroke();
  constants.menuContext.setLineDash([]);

};
const renderBlock = (colors, x, y, lum, direction = 'horizontal') => {
  constants.menuContext.fillStyle = `hsl(${colors.sides[0].h}, ${colors.sides[0].s}%, ${colors.sides[0].l * lum}%)`;
  constants.menuContext.fillRect(
    CTDLGAME.viewport.x + x,
    CTDLGAME.viewport.y + y - 1,
    5,
    1
  );
  constants.menuContext.fillStyle = `hsl(${colors.sides[1].h}, ${colors.sides[1].s}%, ${colors.sides[1].l * lum}%)`;
  constants.menuContext.fillRect(
    CTDLGAME.viewport.x + x - 1,
    CTDLGAME.viewport.y + y - 1,
    1,
    6
  );
  for (let i = 0; i < 6; i++) {
    constants.menuContext.fillStyle = `hsl(${colors.body[i].h}, ${colors.body[i].s}%, ${colors.body[i].l * lum}%)`;
    constants.menuContext.fillRect(
      CTDLGAME.viewport.x + x + (direction === 'vertical' ? 0 : i),
      CTDLGAME.viewport.y + y + (direction === 'horizontal' ? 0 : i),
      direction === 'vertical' ? 6 : 1,
      direction === 'horizontal' ? 6 : 1
    );
  }
};


/**
 * @description Method to display progress bar
 * @param {Number} progress current progress between 0 - 1
 */
export const showProgressBar = progress => {
  const queueBrightness = 1 - Math.abs(Math.sin(CTDLGAME.frame / 36) * .1);
  const blocksInQueue = Math.ceil((1 - progress) * 3);

  constants.menuContext.fillStyle = '#212121';
  constants.menuContext.fillRect(
    CTDLGAME.viewport.x,
    CTDLGAME.viewport.y,
    constants.WIDTH,
    constants.HEIGHT
  );

  renderLine();

  const offset = Math.round((progress * 100) % 33.33);
  const offsetSlow = Math.min(8, offset);
  const offsetFast = Math.min(14, offset);
  for (let b = 0; b < blocksInQueue; b++) {
    let x = constants.WIDTH / 2 - (8 * (b + 1)) - 2;
    x += b === 0 ? offsetFast : offsetSlow;
    const y = constants.HEIGHT / 2 - 12;
    renderBlock(
      b === 0 && offsetSlow === 8 ? colors.mined : colors.queued,
      x,
      y,
      b === 0 && offsetSlow === 8 ? 1 : queueBrightness,
      b === 0 && offsetSlow === 8 ? 'vertical': 'horizontal'
    );
  }

  for (let b = 0; b < 3; b++) {
    const x = constants.WIDTH / 2 + (8 * (b + 1)) - 4 + offsetSlow;
    const y = constants.HEIGHT / 2 - 12;
    renderBlock(colors.mined, x, y, 1, 'vertical');
  }
  constants.menuContext.fillStyle = '#212121';
  constants.menuContext.fillRect(
    CTDLGAME.viewport.x + constants.WIDTH / 2 + 8 * 3 + 4,
    CTDLGAME.viewport.y + constants.HEIGHT / 2 - 13,
    constants.WIDTH,
    9
  );

  write(
    constants.menuContext,
    Math.round(progress * 100) + '%', {
      x: progressBar.x + CTDLGAME.viewport.x,
      y: progressBar.y + CTDLGAME.viewport.y + progressBar.h + 1,
      w: progressBar.w
    },
    'center'
  );
};