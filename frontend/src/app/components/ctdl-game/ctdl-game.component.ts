import { Component } from '@angular/core';
import { StateService } from '../../services/state.service';
import * as db from './src/db';
import { initEvents, loadGameButton, initGameButton } from './src/events';
import constants, { initConstants } from './src/constants';
import {
  CTDLGAME,
  loadAsset,
  showStartGameScreen,
  showStartScreen,
  showProgressBar,
  showOverlay,
  updateViewport,
  showMenu,
  checkBlocks,
  getTimeOfDay,
  clearCanvas,
  saveStateExists,
  cleanUpStage,
  showSettings,
  executeHooks,
} from './src/gameUtils';
import { prompt, writeMenu } from './src/textUtils';
import { applyGravity } from './src/physicsUtils';
import { isSoundLoaded, toggleSounds } from './src/sounds';
import { toggleSoundtrack, stopMusic } from './src/soundtrack';
import { showFrameRate } from './src/debugUtils';

let isFocused = false;
@Component({
  selector: 'ctdl-game',
  templateUrl: './ctdl-game.component.html',
  styleUrls: ['./ctdl-game.component.scss'],
})
export class CTDLGAMEComponent {
  constructor(private stateService: StateService) {}
  ngAfterViewInit(): void {
    isFocused = true;
    initConstants();
    const $window = window as any;
    $window.SELECTED = null;
    $window.SELECTEDCHARACTER = null;

    let time;
    // @ts-ignore
    document.querySelector('.navbar-nav').style.display = 'none';

    /**
     * @description Method to init the game
     * @returns {void}
     */
    async function init() {
      let i = 0;
      const len = Object.keys(CTDLGAME.assets).length;
      for (const key in CTDLGAME.assets) {
        CTDLGAME.assets[key] = await loadAsset(CTDLGAME.assets[key]);
        constants.overlayContext.clearRect(
          CTDLGAME.viewport.x,
          CTDLGAME.viewport.y,
          constants.WIDTH,
          constants.HEIGHT
        );

        showProgressBar(i / (len - 1));
        i++;
      }

      await db.init(constants.debug);

      const options = await db.get('options');
      if (options) CTDLGAME.options = options;
      toggleSoundtrack(CTDLGAME.options.music);
      toggleSounds(CTDLGAME.options.sound);

      CTDLGAME.isSoundLoaded = isSoundLoaded();

      if (CTDLGAME.isSoundLoaded) {
        initGameButton.active = false;
        if (!(await saveStateExists())) {
          CTDLGAME.newGame = true;
        } else {
          loadGameButton.active = true;
        }

        initEvents(CTDLGAME.startScreen);
      }

      constants.overlayContext.clearRect(
        CTDLGAME.viewport.x,
        CTDLGAME.viewport.y,
        constants.WIDTH,
        constants.HEIGHT
      );

      tick();
    }

    init();

    /**
     * @description Method to to execute game logic for each tick
     * It also takes care of rendering a frame at specified framerate
     */
    function tick() {
      if (!isFocused) return;
      CTDLGAME.frame++;
      if (CTDLGAME.startScreen) {
        clearCanvas();

        showStartScreen();
        showFrameRate();
        return $window.requestAnimationFrame(tick);
      } else if (CTDLGAME.frame % constants.FRAMERATE !== 0) {
        // throttle framerate
        return $window.requestAnimationFrame(tick);
      }

      if (!CTDLGAME.isSoundLoaded) {
        showStartGameScreen();

        showFrameRate();
        return $window.requestAnimationFrame(tick);
      }

      if (CTDLGAME.cutScene) {
        clearCanvas();

        writeMenu();
        showSettings();

        showFrameRate();
        return $window.requestAnimationFrame(tick);
      }

      if (!CTDLGAME.hodlonaut || !CTDLGAME.world?.ready) {
        showFrameRate();

        return $window.requestAnimationFrame(tick);
      }

      time = getTimeOfDay();
      if (
        CTDLGAME.frame !== 0 &&
        CTDLGAME.frame % constants.CHECKBLOCKTIME === 0
      )
        checkBlocks();

      if (CTDLGAME.prompt) {
        prompt(CTDLGAME.prompt);

        return $window.requestAnimationFrame(tick);
      }

      clearCanvas();

      if (CTDLGAME.world) cleanUpStage();

      CTDLGAME.world.update();

      applyGravity();

      // update objects that shall update and are in viewport
      CTDLGAME.objects
        .filter((obj) => obj.update && obj.inViewport)
        .forEach((obj) => obj.update());

      if (CTDLGAME.world.map.update) CTDLGAME.world.map.update();

      executeHooks();

      updateViewport();

      CTDLGAME.quadTree.clear();
      CTDLGAME.objects
        .filter((obj) => obj.inViewport)
        .forEach((obj) => CTDLGAME.quadTree.insert(obj));

      if (CTDLGAME.showOverlay) showOverlay();

      showMenu(CTDLGAME.inventory);
      writeMenu();

      if (CTDLGAME.frame > constants.FRAMERESET) {
        CTDLGAME.frame = 0;
      }

      showFrameRate();
      return $window.requestAnimationFrame(tick);
    }

    $window.CTDLGAME = CTDLGAME;
    $window.constants = constants;
  }
  ngOnDestroy(): void {
    isFocused = false;
    stopMusic();
  }
}
