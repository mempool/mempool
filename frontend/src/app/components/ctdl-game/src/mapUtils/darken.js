import constants from '../constants';
import { CTDLGAME } from '../gameUtils';

/**
 * @description Method to darken map
 * @param {Number} darkness intensity of darkness (0-1)
 * @param {Number} darkness2 intensity of darkness of char and game context (0-1)
 * @param {String} color color to darken with
 */
export const darken = (darkness, darkness2, color) => {
    constants.skyContext.globalAlpha = darkness;
    constants.skyContext.globalCompositeOperation = 'source-over';

    constants.bgContext.globalAlpha = darkness;
    constants.bgContext.globalCompositeOperation = 'source-atop';

    constants.fgContext.globalAlpha = darkness;
    constants.fgContext.globalCompositeOperation = 'source-atop';

    constants.charContext.globalAlpha = darkness2;
    constants.charContext.globalCompositeOperation = 'source-atop';

    constants.gameContext.globalAlpha = darkness2;
    constants.gameContext.globalCompositeOperation = 'source-atop'

    ;[
        constants.skyContext,
        constants.bgContext,
        constants.fgContext,
        constants.charContext,
        constants.gameContext
    ].map(context => {
        context.fillStyle = color;
        context.fillRect(CTDLGAME.viewport.x, CTDLGAME.viewport.y, constants.WIDTH, constants.HEIGHT);
    });
};

export default darken;