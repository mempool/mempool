import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { defaultMempoolFeeColors, contrastMempoolFeeColors, lightMempoolFeeColors } from '@app/app.constants';
import { StorageService } from '@app/services/storage.service';
import { StateService } from '@app/services/state.service';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  style: HTMLLinkElement | null = null;
  theme: string = 'default';
  themeState$: BehaviorSubject<{ theme: string; loading: boolean; }>;
  mempoolFeeColors: string[] = defaultMempoolFeeColors;
  initialLoad: boolean = true;

  constructor(
    private storageService: StorageService,
    private stateService: StateService,
  ) {
    let theme = this.stateService.env.customize?.theme || this.storageService.getValue('theme-preference') || 'default';
    // theme preference must be a valid known public theme
    if (!this.stateService.env.customize?.theme && !['default', 'contrast', 'softsimon', 'nymkappa'].includes(theme)) {
      theme = 'default';
      this.storageService.setValue('theme-preference', 'default');
    }
    if (!this.stateService.env.customize?.theme) {
      const aprilThemeState = this.storageService.getValue('april-theme');
      if (this.isAprilFirst()) {
        if (aprilThemeState !== 'dismissed') {
          if (aprilThemeState !== 'active') {
            this.storageService.setValue('april-theme-backup', this.storageService.getValue('theme-preference') || 'default');
            this.storageService.setValue('april-theme', 'active');
          }
          theme = 'nymkappa';
        }
      } else if (aprilThemeState === 'active') {
        theme = this.storageService.getValue('april-theme-backup') || 'default';
        this.storageService.setValue('theme-preference', theme);
        this.clearAprilTheme();
      } else if (aprilThemeState === 'dismissed') {
        this.clearAprilTheme();
      }
    }
    this.themeState$ = new BehaviorSubject({ theme, loading: false });
    this.apply(theme);
  }

  setTheme(theme: string): void {
    if (!this.stateService.env.customize?.theme && this.isAprilFirst()) {
      this.storageService.setValue('april-theme', 'dismissed');
      this.storageService.removeItem('april-theme-backup');
    } else {
      this.clearAprilTheme();
    }
    this.apply(theme);
  }

  clearAprilTheme(): void {
    this.storageService.removeItem('april-theme');
    this.storageService.removeItem('april-theme-backup');
  }

  private apply(theme: string): void {
    if (this.theme === theme) {
      return;
    }

    this.theme = theme;
    if (theme === 'default') {
      if (this.style) {
        this.style.remove();
        this.style = null;
      }
      if (!this.stateService.env.customize?.theme) {
        this.storageService.setValue('theme-preference', theme);
      }
      this.mempoolFeeColors = defaultMempoolFeeColors;
      this.themeState$.next({ theme, loading: false });
      return;
    }

    // Load theme stylesheet
    this.themeState$.next({ theme, loading: true });
    try {
      if (!this.style) {
        this.style = document.createElement('link');
        this.style.rel = 'stylesheet';
        if (this.initialLoad) {
          this.style.media = 'print'; // Prevent white flash and other CSS issues when using custom theme on initial app load in Safari
        }
        document.head.appendChild(this.style); // load the css now
      }

      this.style.onload = () => {
        if (this.initialLoad) {
          this.style.media = 'all';
          this.initialLoad = false;
        }
        this.mempoolFeeColors = this.getMempoolFeeColors(theme);
        this.themeState$.next({ theme, loading: false });
      };
      this.style.onerror = () => this.apply('default');
      this.style.href = this.getThemeFile(theme);

      if (!this.stateService.env.customize?.theme) {
        this.storageService.setValue('theme-preference', theme);
      }
    } catch (err) {
      console.log('failed to apply theme stylesheet: ', err);
      this.apply('default');
    }
  }

  private getThemeFile(theme: string): string {
    const themeFiles = (window as any).__env?.THEME_FILES;
    if (themeFiles?.[theme]) {
      return themeFiles[theme];
    }
    return `${theme}.css`;
  }

  private getMempoolFeeColors(theme: string): string[] {
    switch (theme) {
      case 'contrast':
      case 'bukele':
        return contrastMempoolFeeColors;
      case 'nymkappa':
        return lightMempoolFeeColors;
      default:
        return defaultMempoolFeeColors;
    }
  }

  private isAprilFirst(): boolean {
    const now = new Date();
    return now.getMonth() === 3 && now.getDate() === 1;
  }
}
