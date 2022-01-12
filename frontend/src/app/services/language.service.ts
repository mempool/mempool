import { DOCUMENT, getLocaleId } from '@angular/common';
import { LOCALE_ID, Inject, Injectable } from '@angular/core';
import { languages } from 'src/app/app.constants';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private language = 'en';
  private languages = languages;
  constructor(
    @Inject(DOCUMENT) private document: Document,
    @Inject(LOCALE_ID) private locale: string,
  ) { }

  getLanguage(): string {
    return getLocaleId(this.locale).substring(0, 2);
  }

  stripLanguageFromUrl(urlPath: string) {
    let rawUrlPath = urlPath ? urlPath : document.location.pathname;
    const urlLanguage = this.document.location.pathname.split('/')[1];
    if (this.languages.map((lang) => lang.code).indexOf(urlLanguage) != -1) {
      rawUrlPath = rawUrlPath.substring(3);
    }
    return rawUrlPath;
  }

  getLanguageForUrl(): string {
    let lang = this.getLanguage();
    return lang === 'en' ? '' : '/' + lang;
  }

  setLanguage(language: string): void {
    this.language = language;
    try {
      document.cookie = `lang=${language}; expires=Thu, 18 Dec 2050 12:00:00 UTC; path=/`;
    } catch (e) { }
  }
}
