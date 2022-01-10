import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { languages } from 'src/app/app.constants';
import { RelativeUrlPipe } from '../shared/pipes/relative-url/relative-url.pipe';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private language = 'en';
  private languages = languages;
  constructor(
    @Inject(DOCUMENT) private document: Document,
    private relativeUrlPipe: RelativeUrlPipe,
  ) { }

  getLanguage(): string {
    return this.language;
  }

  getLanguageForUrl() {
    return this.language === 'en' ? '' : '/' + this.language;
  }

  setLocalLanguage() {
    const urlLanguage = this.document.location.pathname.split('/')[1];
    if (this.languages.map((lang) => lang.code).indexOf(urlLanguage) > -1) {
      this.language = urlLanguage;
    } else {
      this.language = 'en';
    }
  }

  setLanguage(language: string): void {
    try {
      document.cookie = `lang=${language}; expires=Thu, 18 Dec 2050 12:00:00 UTC; path=/`;
    } catch (e) { }

    this.document.location.href = this.relativeUrlPipe.transform(`/${language}/`);
  }
}
