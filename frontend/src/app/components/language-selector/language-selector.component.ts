import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { languages } from '../../app.constants';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.component.html',
  styleUrls: ['./language-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LanguageSelectorComponent implements OnInit {
  languageForm: FormGroup;
  languages = languages;

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private formBuilder: FormBuilder,
    private languageService: LanguageService,
  ) { }

  ngOnInit() {
    this.languageForm = this.formBuilder.group({
      language: ['en']
    });
    this.languageForm.get('language').setValue(this.languageService.getLanguage());
  }

  changeLanguage() {
    const newLang = this.languageForm.get('language').value;
    this.languageService.setLanguage(newLang);
    const rawUrlPath = this.languageService.stripLanguageFromUrl(null);
    this.document.location.href = (newLang !== 'en' ? `/${newLang}` : '') + rawUrlPath;
  }
}
