import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ThemeService } from '@app/services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSelectorComponent implements OnInit {
  themeForm: UntypedFormGroup;
  themes = ['default', 'contrast', 'softsimon', 'bukele'];
  themeStateSubscription: Subscription;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private themeService: ThemeService,
  ) { }

  ngOnInit() {
    this.themeForm = this.formBuilder.group({
      theme: ['default']
    });
    this.themeStateSubscription = this.themeService.themeState$.subscribe(({ theme, loading }) => {
      console.log('Theme state changed:', theme, loading);
      this.themeForm.get('theme')?.setValue(theme, { emitEvent: false });
      if (loading) {
        this.themeForm.get('theme')?.disable({ emitEvent: false });
      } else {
        this.themeForm.get('theme')?.enable({ emitEvent: false });
      }
    });
  }

  changeTheme() {
    const newTheme = this.themeForm.get('theme')?.value;
    this.themeService.apply(newTheme);
  }

  ngOnDestroy() {
    this.themeStateSubscription.unsubscribe();
  }
}
