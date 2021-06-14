import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Language, languages } from 'src/app/app.constants';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSelectorComponent implements OnInit {
  languageForm: FormGroup;
  languages: Language[];

  constructor(
    private formBuilder: FormBuilder,
    private stateService: StateService,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit() {
    this.languages = languages;

    this.languageForm = this.formBuilder.group({
      language: [''],
    });
    this.setLanguageFromUrl();
  }

  setLanguageFromUrl() {
    const urlLanguage = this.document.location.pathname.split('/')[1];
    if (this.languages.map(lang => lang.code).indexOf(urlLanguage) > -1) {
      this.languageForm.get('language').setValue(urlLanguage);
    } else {
      this.languageForm.get('language').setValue('en');
    }
  }

  changeLanguage() {
    const language = this.languageForm.get('language').value;
    try {
      document.cookie = `lang=${language}; expires=Thu, 18 Dec 2050 12:00:00 UTC; path=/`;
    } catch (e) {}
    this.document.location.href = `/${language}/${this.stateService.network}`;
  }
}
