import hexToRgb from './hexToRgb';
import { rgbToHsl } from './rgbToHsl';

export const hexToHsl = hex => rgbToHsl(hexToRgb(hex));

export default hexToHsl;