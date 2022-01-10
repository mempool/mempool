import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { languages } from 'src/app/app.constants';
import { LanguageService } from 'src/app/services/language.service';

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
    this.languageService.setLanguage(this.languageForm.get('language').value);
  }
}
