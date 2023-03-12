/* eslint-disable no-undef */
const WIDTH = 128; // viewport
const HEIGHT = 256; // viewport
const START = { x: 512, y: 1024 - HEIGHT, w: WIDTH, h: HEIGHT };
const MENU = { x: 0, y: HEIGHT - 64, w: WIDTH, h: 64 };
const TEXTBOX = { x: 0, y: HEIGHT - MENU.h + 24, w: WIDTH };

const CONTROLS = {
  singlePlayer: {
    q: 'jump',
    ' ': 'jump',
    e: 'attack',
    enter: 'attack',
    s: 'duck',
    w: 'back',
    a: 'moveLeft',
    d: 'moveRight'
  },
  hodlonaut: {
    q: 'jump',
    e: 'attack',
    s: 'duck',
    w: 'back',
    a: 'moveLeft',
    d: 'moveRight',
  },
  katoshi: {
    o: 'jump',
    u: 'attack',
    k: 'duck',
    i: 'back',
    j: 'moveLeft',
    l: 'moveRight'
  },
  buttons: {
    jump: 'jump',
    attack: 'attack',
    back: 'back',
    duck: 'duck',
    switch: 'switch',
    moveLeft: 'moveLeft',
    moveRight: 'moveRight'
  }
};

const BUTTONS = [];


export const constants = {
  SLOT: '',
  WIDTH,
  HEIGHT,
  START,
  MENU,
  TEXTBOX,
  FRAMESINADAY: Math.pow(2, 14),
  FRAMERESET: Math.pow(2, 64),
  CHECKBLOCKTIME: Math.pow(2, 12), // check every X frame
  FRAMERATE: 8, // render every X frame
  FRAMERATES: {
    skyContext: 8,
    parallaxContext: 8,
    bgContext: 8,
    charContext: 8,
    gameContext: 8,
    fgContext: 8,
    overlayContext: 8,
    menuContext: 8
  },
  GRAVITY: 2,
  canvases: [],
  skyContext: undefined,
  parallaxContext: undefined,
  bgCanvas: undefined,
  bgContext: undefined,
  gameCanvas: undefined,
  gameContext: undefined,
  fgCanvas: undefined,
  fgContext: undefined,
  charCanvas: undefined,
  charContext: undefined,
  overlayCanvas: undefined,
  overlayContext: undefined,
  menuContext: undefined,
  helperCanvas: undefined,
  helperContext: undefined,
  CONTROLS,
  BUTTONS
};


export const initConstants = () => {
  constants.skyCanvas = document.getElementById('ctdl-game-sky');
  constants.parallaxCanvas = document.getElementById('ctdl-game-parallax');
  constants.bgCanvas = document.getElementById('ctdl-game-bg');
  constants.gameCanvas = document.getElementById('ctdl-game');
  constants.charCanvas = document.getElementById('ctdl-game-chars');
  constants.fgCanvas = document.getElementById('ctdl-game-fg');
  constants.overlayCanvas = document.getElementById('ctdl-game-overlay');
  constants.menuCanvas = document.getElementById('ctdl-game-menu');
  constants.helperCanvas = document.getElementById('ctdl-game-helper');


  constants.canvases = [
    constants.skyCanvas,
    constants.parallaxCanvas,
    constants.bgCanvas,
    constants.gameCanvas,
    constants.charCanvas,
    constants.fgCanvas,
    constants.overlayCanvas,
    constants.menuCanvas
  ];
  constants.canvases.forEach(canvas => {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.height = (Math.round((window.innerHeight - 120) / 2) * 2) + 'px';
  });


  constants.helperCanvas.width = 16;
  constants.helperCanvas.height = 16;

  constants.skyContext = constants.skyCanvas.getContext('2d');
  constants.parallaxContext = constants.parallaxCanvas.getContext('2d');
  constants.bgContext = constants.bgCanvas.getContext('2d');
  constants.gameContext = constants.gameCanvas.getContext('2d');
  constants.fgContext = constants.fgCanvas.getContext('2d');
  constants.charContext = constants.charCanvas.getContext('2d');
  constants.overlayContext = constants.overlayCanvas.getContext('2d');
  constants.menuContext = constants.menuCanvas.getContext('2d');
  constants.helperContext = constants.helperCanvas.getContext('2d')

  ;[
    constants.skyContext,
    constants.parallaxContext,
    constants.bgContext,
    constants.gameContext,
    constants.fgContext,
    constants.charContext,
    constants.overlayContext,
    constants.menuContext
  ].forEach(context => {
    context.imageSmoothingEnabled = false;
    context.translate(-START.x, -START.y);
  });
};

export default constants;