import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { UntypedFormBuilder, UntypedFormGroup } from '@angular/forms';
import { ThemeService } from '@app/services/theme.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-theme-selector',
  templateUrl: './theme-selector.component.html',
  styleUrls: ['./theme-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThemeSelectorComponent implements OnInit {
  themeForm: UntypedFormGroup;
  themes = ['default', 'contrast', 'wiz', 'bukele'];
  themeSubscription: Subscription;

  constructor(
    private formBuilder: UntypedFormBuilder,
    private themeService: ThemeService,
  ) { }

  ngOnInit() {
    this.themeForm = this.formBuilder.group({
      theme: ['default']
    });
    this.themeForm.get('theme')?.setValue(this.themeService.theme);
    // Subscribe to theme changes because two instances of this component exist
    this.themeSubscription = this.themeService.themeChanged$.subscribe(() => {
      if (this.themeForm.get('theme')?.value !== this.themeService.theme){
        this.themeForm.get('theme')?.setValue(this.themeService.theme);
      }
    });
  }

  changeTheme() {
    const newTheme = this.themeForm.get('theme')?.value;
    this.themeService.apply(newTheme);
  }

  ngOnDestroy() {
    this.themeSubscription.unsubscribe();
  }
}
