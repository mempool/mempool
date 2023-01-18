import { Injectable } from '@angular/core';
import { audit, Subject } from 'rxjs';
import { Color } from '../components/block-overview-graph/sprite-types';
import { defaultMempoolFeeColors, contrastMempoolFeeColors } from '../app.constants';
import { StorageService } from './storage.service';

const defaultAuditColors = {
  censored: hexToColor('f344df'),
  missing: darken(desaturate(hexToColor('f344df'), 0.3), 0.7),
  added: hexToColor('0099ff'),
  selected: darken(desaturate(hexToColor('0099ff'), 0.3), 0.7),
};
const contrastAuditColors = {
  censored: hexToColor('ffa8ff'),
  missing: darken(desaturate(hexToColor('ffa8ff'), 0.3), 0.7),
  added: hexToColor('00bb98'),
  selected: darken(desaturate(hexToColor('00bb98'), 0.3), 0.7),
};

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  style: HTMLLinkElement;
  theme: string = 'default';
  themeChanged$: Subject<string> = new Subject();
  mempoolFeeColors: string[] = defaultMempoolFeeColors;

  /* block visualization colors */
  defaultHoverColor: Color;
  feeColors: Color[];
  auditFeeColors: Color[];
  auditColors: { [category: string]: Color } = defaultAuditColors;

  constructor(
    private storageService: StorageService,
  ) {
    const theme = this.storageService.getValue('theme-preference') || 'default';
    this.apply(theme);
  }

  apply(theme) {
    this.theme = theme;
    if (theme !== 'default') {
      if (theme === 'contrast') {
        this.mempoolFeeColors = contrastMempoolFeeColors;
        this.auditColors = contrastAuditColors;
      }
      try {
        if (!this.style) {
          this.style = document.createElement('link');
          this.style.rel = 'stylesheet';
          this.style.href = `${theme}.css`;
          document.head.appendChild(this.style);
        } else {
          this.style.href = `${theme}.css`;
        }
      } catch (err) {
        console.log('failed to apply theme stylesheet: ', err);
      }
    } else {
      this.mempoolFeeColors = defaultMempoolFeeColors;
      this.auditColors = defaultAuditColors;
      if (this.style) {
        this.style.remove();
        this.style = null;
      }
    }
    this.updateFeeColors();
    this.storageService.setValue('theme-preference', theme);
    this.themeChanged$.next(this.theme);
  }

  updateFeeColors() {
    this.defaultHoverColor = hexToColor('1bd8f4');
    this.feeColors = this.mempoolFeeColors.map(hexToColor);
    this.auditFeeColors = this.feeColors.map((color) => darken(desaturate(color, 0.3), 0.9));
  }
}

export function hexToColor(hex: string): Color {
  return {
    r: parseInt(hex.slice(0, 2), 16) / 255,
    g: parseInt(hex.slice(2, 4), 16) / 255,
    b: parseInt(hex.slice(4, 6), 16) / 255,
    a: 1
  };
}

export function desaturate(color: Color, amount: number): Color {
  const gray = (color.r + color.g + color.b) / 6;
  return {
    r: color.r + ((gray - color.r) * amount),
    g: color.g + ((gray - color.g) * amount),
    b: color.b + ((gray - color.b) * amount),
    a: color.a,
  };
}

export function darken(color: Color, amount: number): Color {
  return {
    r: color.r * amount,
    g: color.g * amount,
    b: color.b * amount,
    a: color.a,
  }
}
