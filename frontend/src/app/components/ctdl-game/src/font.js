import font from './sprites/font';
import { CTDLGAME } from './gameUtils';

export const write = (context, text, { x, y, w }, align = 'left', shadow, limit = 999, sub, color) => {
  const startX = align !== 'right' ? x : x + w;
  const endX = align !== 'right' ? startX + w : startX - w;

  if (shadow) {
    write(context, text, { x: x + 1, y: y, w }, align, false, limit, sub);
    context.globalCompositeOperation = 'difference';
    write(context, text, { x: x + 1, y: y, w }, align, false, limit, sub);
    context.globalCompositeOperation = 'source-over';
    write(context, text, { x: x, y: y + 1, w }, align, false, limit, sub);
    context.globalCompositeOperation = 'difference';
    write(context, text, { x: x, y: y + 1, w }, align, false, limit, sub);
    context.globalCompositeOperation = 'source-over';
  }

  text = text.split('');

  if (align === 'right') {
    x = startX;
    text.reverse();
  } else if (align === 'center') {
    const textWidth = text.reduce((w, char) => {
      const data = !sub ? font[char] || font['?'] : font['sub-' + char] || font['?'];
      return w + data.w + 1;
    }, 0);
    if (textWidth < w) x = startX + Math.round((w - textWidth) / 2);
  }

  text.some(char => {
    const data = !sub ? font[char] || font['?'] : font['sub-' + char] || font['?'];
    if (char === '\n'
      || (align === 'left' && x + data.w > endX)
      || (align === 'right' && x - data.w < endX)) {
      x = startX;
      y += data.h;
    }

    if (align === 'right') {
      x = x - data.w;
    }

    if (char !== '\n' && !(char === ' ' && x === startX)) {
      context.drawImage(
        CTDLGAME.assets.font,
        data.x, data.y, data.w, data.h,
        x, y, data.w, data.h
      );

      if (color) {
        context.globalCompositeOperation = 'source-atop';
        context.fillStyle = color;
        context.fillRect(x, y, data.w, data.h);
        context.globalCompositeOperation = 'source-over';
      }

      if (align !== 'right') {
        x += data.w + 1;
      } else {
        x -= 1;
      }
    }

    limit--;
    if (limit < 0) return true;
  });
};