import constants from '../constants';
import { CTDLGAME } from './CTDLGAME';
import { write } from '../font';
import { canDrawOn } from '../performanceUtils';
import { showSettings } from './showSettings';
import { playSound } from '../sounds';
import { initSoundtrack } from '../soundtrack';
import { loadGameButton, multiPlayerButton, newGameButton, singlePlayerButton } from '../events';

const velocity = 4;
let logoOffsetTop = -100;
let logoOffsetBottom = 180;
let musicStart = 180;

const shock = (element, x = 0, y = 1) => {
  element.style.left = x + 'vh';
  element.style.top = y + 'vh';
  setTimeout(() => {
    element.style.left = '0';
    element.style.top = '0';
  });
};

/**
 * @description Method to display progress bar
 * @returns {void}
 */
export const showStartScreen = () => {
  const $body = document.getElementById('ctdl-game-app');

  if (logoOffsetTop < 0) logoOffsetTop += velocity;
  if (logoOffsetTop === -velocity) {
    shock($body, 1, .5);
  }
   if (logoOffsetTop === -velocity && CTDLGAME.options.sound) {
    playSound('drop');
  }
  if (logoOffsetBottom > 0) logoOffsetBottom -= velocity;
  if (logoOffsetBottom === velocity) {
    shock($body, -1, .5);
  }
  if (logoOffsetBottom === velocity && CTDLGAME.options.sound) {
    playSound('drop');
  }
  if (musicStart > 0) musicStart -= velocity;
  if (musicStart === velocity) initSoundtrack('mariamMatremVirginem');

  constants.gameContext.clearRect(
    CTDLGAME.viewport.x,
    CTDLGAME.viewport.y + constants.HEIGHT / 3,
    constants.WIDTH,
    51
  );
  constants.gameContext.drawImage(
    CTDLGAME.assets.logo,
    0, 0, 41, 10,
    CTDLGAME.viewport.x + constants.WIDTH / 2 - 20 + logoOffsetTop,
    CTDLGAME.viewport.y + constants.HEIGHT / 3,
    41, 10
  );
  constants.gameContext.drawImage(
    CTDLGAME.assets.logo,
    0, 10, 41, 10,
    CTDLGAME.viewport.x + constants.WIDTH / 2 - 20 + logoOffsetBottom,
    CTDLGAME.viewport.y + constants.HEIGHT / 3 + 10,
    41, 10
  );

  showSettings();

  if (!canDrawOn('menuContext')) return; // do net render menu yet
  if (newGameButton.active) {
    write(
      constants.menuContext,
      CTDLGAME.frame % (constants.FRAMERATES.menuContext * 8) > constants.FRAMERATES.menuContext * 4 ? '~ new game' : 'new game',
      {
        x: CTDLGAME.viewport.x + newGameButton.x - 10,
        y: CTDLGAME.viewport.y + newGameButton.y,
        w: newGameButton.w
      },
      'right'
    );
  }

  if (!CTDLGAME.newGame && loadGameButton.active) {
    write(
      constants.menuContext,
      CTDLGAME.frame % (constants.FRAMERATES.menuContext * 8) > constants.FRAMERATES.menuContext * 4 ? '~ resume game' : 'resume game',
      {
        x: CTDLGAME.viewport.x + loadGameButton.x - 10,
        y: CTDLGAME.viewport.y + loadGameButton.y,
        w: loadGameButton.w
      },
      'right'
    );
  }

  if (!CTDLGAME.touchScreen) {
    write(
      constants.menuContext,
      CTDLGAME.multiPlayer ? '1P' : '> 1P',
      {
        x: CTDLGAME.viewport.x + singlePlayerButton.x - 10,
        y: CTDLGAME.viewport.y + singlePlayerButton.y,
        w: singlePlayerButton.w
      },
      'right'
    );
    write(
      constants.menuContext,
      CTDLGAME.multiPlayer ? '> 2P' : '2P',
      {
        x: CTDLGAME.viewport.x + multiPlayerButton.x - 10,
        y: CTDLGAME.viewport.y + multiPlayerButton.y,
        w: multiPlayerButton.w
      },
      'right'
    );

    write(
      constants.menuContext,
      [
        '',
        'move:',
        'jump:',
        'attack:',
        !CTDLGAME.multiPlayer ? 'switch:' : ''
      ].join('\n'), {
        x: CTDLGAME.viewport.x + constants.WIDTH / 2 - 41,
        y: CTDLGAME.viewport.y + constants.HEIGHT / 2 + 60,
        w: 60
      },
      'left'
    );
    write(
      constants.menuContext,
      [
        'P1:',
        'WASD',
        !CTDLGAME.multiPlayer ? 'Q / SPACE' : 'Q',
        !CTDLGAME.multiPlayer ? 'E / ENTER' : 'E',
        !CTDLGAME.multiPlayer ? 'TAB' : ''
      ].join('\n'), {
        x: CTDLGAME.viewport.x + constants.WIDTH / 2,
        y: CTDLGAME.viewport.y + constants.HEIGHT / 2 + 60,
        w: 60
      },
      'left'
    );
    if (CTDLGAME.multiPlayer) {
      write(
        constants.menuContext,
        [
          'P2:',
          'IJKL',
          'O',
          'U'
        ].join('\n'), {
          x: CTDLGAME.viewport.x + constants.WIDTH / 2 + 30,
          y: CTDLGAME.viewport.y + constants.HEIGHT / 2 + 60,
          w: 60
        },
        'left'
      );
    }
  }
};