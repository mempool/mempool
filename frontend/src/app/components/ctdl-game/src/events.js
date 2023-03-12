import * as db from './db';
import { contains, intersects } from './geometryUtils';
import constants from './constants';
import { addHook, CTDLGAME, loadGame, newGame, saveGame, saveStateExists, showIntro } from './gameUtils';
import { setTextQueue, skipText } from './textUtils';
import { addClass, removeClass } from './htmlUtils';
import { stopMusic, toggleSoundtrack } from './soundtrack';
import { isSoundLoaded, playSound, toggleSounds } from './sounds';
import { start } from 'tone';
import { textQueue } from './textUtils/textQueue';

window.KEYS = [];
window.BUTTONS = [];

let buttonClicked;

export const setButtonClicked = button => buttonClicked = button;

// TODO add throttling to events

// TODO refactor into eventUtils
constants.BUTTONS = constants.BUTTONS.concat([
  {
    action: 'initGame',
    x: 0,
    y: 0,
    w: constants.WIDTH,
    h: constants.HEIGHT,
    active: true,
    onclick: async () => {
      await start(); // start tone JS

      CTDLGAME.isSoundLoaded = isSoundLoaded();

      if (!CTDLGAME.isSoundLoaded) return;

      constants.BUTTONS
        .filter(button => /initGame/.test(button.action))
        .forEach(button => button.active = false);

      constants.BUTTONS
        .filter(button => /newGame/.test(button.action))
        .forEach(button => button.active = true);

      if (!(await saveStateExists())) {
        CTDLGAME.newGame = true;
      } else {
        constants.BUTTONS
          .filter(button => /loadGame/.test(button.action))
          .forEach(button => button.active = true);
      }

      initEvents(true);
    }
  },
  {
    action: 'loadGame',
    x: constants.WIDTH / 2 - 41,
    y: constants.HEIGHT / 2 + 20,
    w: 80,
    h: 10,
    active: false,
    onclick: async () => {
      stopMusic();
      playSound('select');

      CTDLGAME.startScreen = false;
      await loadGame();

      constants.BUTTONS
        .filter(button => /newGame|loadGame|singlePlayer|multiPlayer|skipIntro/.test(button.action))
        .forEach(button => button.active = false);

      window.removeEventListener('mouseup', startScreenHandler);
      window.removeEventListener('touchstart', startScreenHandler);
      initEvents(false);
    }
  },
  {
    action: 'newGame',
    x: constants.WIDTH / 2 - 35,
    y: constants.HEIGHT / 2,
    w: 60,
    h: 10,
    active: true,
    onclick: () => {
      playSound('select');

      showIntro();
      CTDLGAME.startScreen = false;
      CTDLGAME.cutScene = true;

      constants.BUTTONS
        .filter(button => /newGame|loadGame|singlePlayer|multiPlayer/.test(button.action))
        .forEach(button => button.active = false);
      constants.BUTTONS
        .filter(button => /skipIntro/.test(button.action))
        .forEach(button => button.active = true);

      window.removeEventListener('mouseup', startScreenHandler);
      window.removeEventListener('touchstart', startScreenHandler);
      initEvents(false);
    }
  },
  {
    action: 'singlePlayer',
    x: constants.WIDTH / 2 - 43,
    y: constants.HEIGHT / 2 + 40,
    w: 30,
    h: 10,
    active: true,
    onclick: () => {
      playSound('select');
      CTDLGAME.multiPlayer = false;
    }
  },
  {
    action: 'multiPlayer',
    x: constants.WIDTH / 2 - 6,
    y: constants.HEIGHT / 2 + 40,
    w: 30,
    h: 10,
    active: true,
    onclick: () => {
      playSound('select');
      CTDLGAME.multiPlayer = true;
    }
  },
  {
    action: 'skipIntro',
    x: constants.WIDTH / 2 - 9,
    y: constants.HEIGHT - 60,
    w: 60,
    h: 10,
    active: false,
    onclick: () => {
      playSound('select');

      setTextQueue([]);
      stopMusic();
      CTDLGAME.cutScene = false;
      newGame();

      constants.BUTTONS
        .filter(button => /skipIntro/.test(button.action))
        .forEach(button => button.active = false);
    }
  },
  {
    action: 'skipCutScene',
    x: constants.WIDTH - 30,
    y: constants.HEIGHT - 12,
    w: 30,
    h: 10,
    active: false,
    onclick: () => {
      textQueue.map(text => text.callback ? text.callback() : null);
      setTextQueue([]);

      constants.BUTTONS
        .filter(button => /skipIntro/.test(button.action))
        .forEach(button => button.active = false);
    }
  },
  {
    action: 'yes',
    x: 10,
    y: constants.HEIGHT - 12,
    w: 30,
    h: 10,
    active: false,
    disable: () => {
      constants.BUTTONS
        .filter(button => /yes/.test(button.action))
        .forEach(button => button.active = false);
    }
  },
  {
    action: 'nah',
    x: constants.WIDTH - 40,
    y: constants.HEIGHT - 12,
    w: 30,
    h: 10,
    active: false,
    disable: () => {
      constants.BUTTONS
        .filter(button => /nah/.test(button.action))
        .forEach(button => button.active = false);
    }
  },
  {
    action: 'save',
    x: 3,
    y: 3,
    w: 9,
    h: 9,
    active: true,
    onclick: () => {
      saveGame();
    }
  },
  {
    action: 'music',
    x: constants.WIDTH - 3 - 9 - 11,
    y: 3,
    w: 9,
    h: 9,
    active: true,
    onclick: async () => {
      CTDLGAME.options.music = !CTDLGAME.options.music;
      toggleSoundtrack(CTDLGAME.options.music);
      await db.set('options', CTDLGAME.options);
    }
  },
  {
    action: 'sound',
    x: constants.WIDTH - 3 - 9 ,
    y: 3,
    w: 9,
    h: 9,
    active: true,
    onclick: async () => {
      CTDLGAME.options.sound = !CTDLGAME.options.sound;
      await db.set('options', CTDLGAME.options);
      toggleSounds(CTDLGAME.options.sound);
    }
  },
  { action: 'jump', x: 21 * 4, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true},
  { action: 'attack', x: 21 * 5, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true},
  { action: 'moveLeft', x: 0, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true},
  { action: 'moveRight', x: 21, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true},
  { action: 'back', x: 21 * 2, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true},
  { action: 'duck', x: 21 * 2, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true},
  { action: 'switch', x: 21 * 3, y: constants.HEIGHT - 20, w: 18, h: 18, active: false, hasBorder: true, onclick: switchCharacter}
]);

export const initGameButton = constants.BUTTONS.find(btn => btn.action === 'initGame');
export const newGameButton = constants.BUTTONS.find(btn => btn.action === 'newGame');
export const loadGameButton = constants.BUTTONS.find(btn => btn.action === 'loadGame');
export const singlePlayerButton = constants.BUTTONS.find(btn => btn.action === 'singlePlayer');
export const multiPlayerButton = constants.BUTTONS.find(btn => btn.action === 'multiPlayer');
export const skipCutSceneButton = constants.BUTTONS.find(btn => btn.action === 'skipCutScene');
export const yesButton = constants.BUTTONS.find(btn => btn.action === 'yes');
export const nahButton = constants.BUTTONS.find(btn => btn.action === 'nah');
export const saveButton = constants.BUTTONS.find(button => button.action === 'save');
export const musicButton = constants.BUTTONS.find(button => button.action === 'music');
export const soundButton = constants.BUTTONS.find(button => button.action === 'sound');
export const duckButton = constants.BUTTONS.find(button => button.action === 'duck');
export const backButton = constants.BUTTONS.find(button => button.action === 'back');

export const startScreenHandler = async (e) => {
  const canvas = e.target;
  if (!/ctdl-game/.test(canvas.id)) {
    return;
  }

  if (e.layerX) {
    CTDLGAME.cursor = {
      x: e.layerX / canvas.clientWidth * canvas.getAttribute('width'),
      y: e.layerY / canvas.clientHeight * canvas.getAttribute('height')
    };
    const buttonPressed = constants.BUTTONS.concat(CTDLGAME.eventButtons).find(button =>
      button.active &&
      CTDLGAME.cursor.x > button.x &&
      CTDLGAME.cursor.x < button.x + button.w &&
      CTDLGAME.cursor.y > button.y &&
      CTDLGAME.cursor.y < button.y + button.h
    );

    if (buttonPressed?.onclick) buttonPressed.onclick();
  } else if (e.touches?.length > 0) {
    e.stopPropagation();
    CTDLGAME.cursor = {
      x: (e.touches[0].clientX - e.target.offsetLeft) / canvas.clientWidth * canvas.getAttribute('width'),
      y: (e.touches[0].clientY - e.target.offsetTop) / canvas.clientHeight * canvas.getAttribute('height')
    };
    CTDLGAME.touchScreen = true;

    constants.BUTTONS
      .filter(button => /moveLeft|moveRight|jump|duck|switch|attack/i.test(button.action))
      .forEach(button => button.active = true);
  }
};

window.addEventListener('mousemove', mouseMoveHandler);
window.addEventListener('mouseup', startScreenHandler);
window.addEventListener('touchstart', startScreenHandler);

export const initEvents = startScreen => {
  try {
    document.createEvent('TouchEvent');
    CTDLGAME.touchScreen = true;
  } catch (e) {
    CTDLGAME.touchScreen = false;
  }

  if (startScreen) {
    window.removeEventListener('mousedown', click);
    window.removeEventListener('touchstart', click);
    window.removeEventListener('mouseup', clickEnd);
    window.removeEventListener('touchend', clickEnd);
    window.removeEventListener('mousemove', mouseMove);
    window.removeEventListener('touchmove', mouseMove);
    window.removeEventListener('touchstart', zoomHandler);
    window.removeEventListener('touchmove', zoomHandler);
    window.addEventListener('resize', resize);

    constants.BUTTONS
      .filter(button => /newGame|loadGame/.test(button.action))
      .forEach(button => button.active = true);
    return;
  }

  if (CTDLGAME.touchScreen) {
    window.addEventListener('touchstart', click);
    window.addEventListener('touchend', clickEnd);
    window.addEventListener('touchmove', mouseMove);
    window.addEventListener('touchstart', zoomHandler);
    window.addEventListener('touchmove', zoomHandler);
  } else {
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ') skipText();
    });
    window.addEventListener('mousedown', click);
    window.addEventListener('mouseup', clickEnd);
    window.addEventListener('mousemove', mouseMove);
  }

  window.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    e.preventDefault();
    if (key === 'tab') {
      switchCharacter();
    }
    if (window.KEYS.indexOf(key) !== -1) return;
    if (key === 'd' && window.KEYS.indexOf('a') !== -1) window.KEYS = window.KEYS.filter(key => key !== 'a');
    if (key === 'a' && window.KEYS.indexOf('d') !== -1) window.KEYS = window.KEYS.filter(key => key !== 'd');
    if (key === 'j' && window.KEYS.indexOf('l') !== -1) window.KEYS = window.KEYS.filter(key => key !== 'l');
    if (key === 'l' && window.KEYS.indexOf('j') !== -1) window.KEYS = window.KEYS.filter(key => key !== 'j');

    window.KEYS.push(key);
  });

  window.addEventListener('keyup', e => {
    if (e.key.toLowerCase() === 'enter') {
      skipText();
    }
    window.KEYS = window.KEYS.filter(key => {
      return key !== e.key.toLowerCase();
    });
  });
};

function resize () {
  constants.canvases.forEach(canvas => {
    canvas.style.height = (Math.round(window.innerHeight / 2) * 2) + 'px';
  });
}

function mouseMoveHandler (e) {
  const canvas = e.target;

  if (!/ctdl-game/.test(canvas.id)) {
    return;
  }

  if (e.layerX) {
    CTDLGAME.cursor = {
      x: e.layerX / canvas.clientWidth * canvas.getAttribute('width'),
      y: e.layerY / canvas.clientHeight * canvas.getAttribute('height')
    };
  }
  let hover = {
    x: CTDLGAME.cursor.x,
    y: CTDLGAME.cursor.y,
    w: 1, h: 1
  };
  const buttonHover = constants.BUTTONS.concat(CTDLGAME.eventButtons)
    .find(button => button.active && intersects(hover, button));

  hover = {
    x: CTDLGAME.cursor.x + CTDLGAME.viewport.x,
    y: CTDLGAME.cursor.y + CTDLGAME.viewport.y,
    w: 1, h: 1
  };
  const blockHover = CTDLGAME.quadTree
    ? CTDLGAME.quadTree.query(hover)
      .filter(obj => obj.getClass() === 'Block')
      .find(block => intersects(hover, block.getBoundingBox()))
    : null;

  if (buttonHover || blockHover) {
    addClass(document.body, 'cursor-pointer');
  } else {
    removeClass(document.body, 'cursor-pointer');
  }

  if (blockHover) {
    if (e.buttons > 0 && buttonClicked) {
      blockHover.isSolid = buttonClicked.isSolid;
    }
  }
}

function click (e) {
  const canvas = e.target;

  if (e.layerX) {
    CTDLGAME.cursor = {
      x: e.layerX / canvas.clientWidth * canvas.getAttribute('width'),
      y: e.layerY / canvas.clientHeight * canvas.getAttribute('height')
    };
  } else if (e.touches?.length > 0) {
    e.stopPropagation();
    window.BUTTONS = [];
    Array.from(e.touches).forEach(touch => {
      CTDLGAME.cursor = {
        x: (touch.clientX - e.target.offsetLeft) / canvas.clientWidth * canvas.getAttribute('width'),
        y: (touch.clientY - e.target.offsetTop) / canvas.clientHeight * canvas.getAttribute('height')
      };
      const buttonPressed = constants.BUTTONS.concat(CTDLGAME.eventButtons).find(button =>
        button.active &&
        CTDLGAME.cursor.x > button.x &&
        CTDLGAME.cursor.x < button.x + button.w &&
        CTDLGAME.cursor.y > button.y &&
        CTDLGAME.cursor.y < button.y + button.h
      );

      if (buttonPressed && !buttonPressed.onclick) {
        window.BUTTONS.unshift(buttonPressed);
      }
    });
  }

  if (!/ctdl-game/.test(canvas.id)) return;

  const buttonPressed = constants.BUTTONS.concat(CTDLGAME.eventButtons).find(button =>
    button.active &&
    CTDLGAME.cursor.x > button.x &&
    CTDLGAME.cursor.x < button.x + button.w &&
    CTDLGAME.cursor.y > button.y &&
    CTDLGAME.cursor.y < button.y + button.h
  );

  if (buttonPressed?.onclick) {
    buttonPressed.onclick();
  } else if (!CTDLGAME.touchScreen && buttonPressed) {
    window.BUTTONS.unshift(buttonPressed);
  }

  if (CTDLGAME.cursor.y > 215 && CTDLGAME.cursor.y < 232) skipText();

  const click = {
    x: CTDLGAME.cursor.x + CTDLGAME.viewport.x,
    y: CTDLGAME.cursor.y + CTDLGAME.viewport.y,
    w: 1, h: 1
  };

  if (!CTDLGAME.quadTree) return;

  const object = CTDLGAME.quadTree.query(click).find(obj => contains(obj.getBoundingBox(), click));

  if (!object && CTDLGAME.ghostBlock && CTDLGAME.ghostBlock.status !== 'bad') {
    // TODO refactor into placeBlock method
    playSound('block');
    CTDLGAME.ghostBlock.context = constants.gameContext;
    CTDLGAME.ghostBlock.opacity = 1;
    CTDLGAME.ghostBlock.isSolid = true;
    CTDLGAME.inventory.blocks.shift();
    CTDLGAME.objects.push(CTDLGAME.ghostBlock);
    if (window.SELECTEDCHARACTER.action.condition()) window.SELECTEDCHARACTER.action.effect();
    CTDLGAME.ghostBlock = null;
  }
  if (window.SELECTED) window.SELECTED.unselect();
  if (!object) return;
  if (object.select) object.select(object);
  if (object.getClass() === 'Block') {
    object.toggleSolid();
  }
}

function clickEnd (e) {
  const canvas = e.target;
  window.BUTTONS = [];
  if (e.layerX) {
    CTDLGAME.cursor = {
      x: e.layerX / canvas.clientWidth * canvas.getAttribute('width'),
      y: e.layerY / canvas.clientHeight * canvas.getAttribute('height')
    };
  } else if (e.touches?.length > 0) {
    e.stopPropagation();

    Array.from(e.touches).forEach(touch => {
      CTDLGAME.cursor = {
        x: (touch.clientX - e.target.offsetLeft) / canvas.clientWidth * canvas.getAttribute('width'),
        y: (touch.clientY - e.target.offsetTop) / canvas.clientHeight * canvas.getAttribute('height')
      };
      const buttonPressed = constants.BUTTONS.find(button =>
        button.active &&
        CTDLGAME.cursor.x > button.x &&
        CTDLGAME.cursor.x < button.x + button.w &&
        CTDLGAME.cursor.y > button.y &&
        CTDLGAME.cursor.y < button.y + button.h
      );

      if (buttonPressed) {
        window.BUTTONS.unshift(buttonPressed);
      }
    });
  }

  CTDLGAME.showOverlay = false;
  CTDLGAME.zoom = null;

  buttonClicked = null;
}

function mouseMove (e) {
  const canvas = e.target;

  if (e.layerX) {
    CTDLGAME.cursor = {
      x: e.layerX / canvas.clientWidth * canvas.getAttribute('width'),
      y: e.layerY / canvas.clientHeight * canvas.getAttribute('height'),
    };
  } else if (e.touches?.length > 0) {
    CTDLGAME.cursor = {
      x: (e.touches[0].clientX - e.target.offsetLeft) / canvas.clientWidth * canvas.getAttribute('width'),
      y: (e.touches[0].clientY - e.target.offsetTop) / canvas.clientHeight * canvas.getAttribute('height')
    };
  }

  if (!/ctdl-game/.test(canvas.id)) {
    return;
  }

  if (CTDLGAME.showShop) return;

  CTDLGAME.showOverlay = true;
}

function zoomHandler (e) {
  const canvas = e.target;
  if (!/ctdl-game/.test(canvas.id)) {
    return;
  }

  CTDLGAME.showOverlay = true;

  CTDLGAME.zoom = {
    x: CTDLGAME.viewport.x + CTDLGAME.cursor.x,
    y: CTDLGAME.viewport.y + CTDLGAME.cursor.y
  };
}

function switchCharacter() {
  addHook(CTDLGAME.frame, () => {
    if (!CTDLGAME.preventCharacterSwitch && window.SELECTEDCHARACTER.id === 'hodlonaut') {
      CTDLGAME.katoshi.choose();
    } else {
      CTDLGAME.hodlonaut.choose();
    }
  });
}