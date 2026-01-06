import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { defaultMempoolFeeColors, contrastMempoolFeeColors } from '@app/app.constants';
import { StorageService } from '@app/services/storage.service';
import { StateService } from '@app/services/state.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  style: HTMLLinkElement | null = null;
  theme: string = 'default';
  themeChanged$: Subject<string> = new Subject();
  mempoolFeeColors: string[] = defaultMempoolFeeColors;

  constructor(
    private storageService: StorageService,
    private stateService: StateService,
  ) {
    const theme = this.stateService.env.customize?.theme || this.storageService.getValue('theme-preference') || 'default';
    this.apply(theme);
  }

  apply(theme: string): void {
    if (this.theme === theme) {
      return;
    }

    this.theme = theme;
    if (theme !== 'default') {
      this.mempoolFeeColors = (theme === 'contrast'  || theme === 'bukele') ? contrastMempoolFeeColors : defaultMempoolFeeColors;
      try {
        if (!this.style) {
          this.style = document.createElement('link');
          this.style.rel = 'stylesheet';
          this.style.href = `${theme}.css`;
          this.style.onerror = (): void => { // something went wrong (eg the css resource does not exist, revert to default)
            this.apply('default');
          };
          document.head.appendChild(this.style); // load the css now
        } else {
          this.style.href = `${theme}.css`;
        }
      } catch (err) {
        console.log('failed to apply theme stylesheet: ', err);
      }
    } else {
      this.mempoolFeeColors = defaultMempoolFeeColors;
      if (this.style) {
        this.style.remove();
        this.style = null;
      }
    }
    if (!this.stateService.env.customize?.theme) {
      this.storageService.setValue('theme-preference', theme);
    }
    this.themeChanged$.next(this.theme);
  }
}
