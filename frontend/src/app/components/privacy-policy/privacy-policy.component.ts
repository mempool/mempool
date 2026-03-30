import { ChangeDetectorRef, Component } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { Subscription } from 'rxjs/internal/Subscription';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-privacy-policy',
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.scss'],
  standalone: false,
})
export class PrivacyPolicyComponent {
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  themeStateSubscription: Subscription;
  loadedTheme = 'default';

  constructor(
    private stateService: StateService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
    private themeService: ThemeService,
    private cd: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Privacy Policy');
    this.seoService.setDescription('Trusted third parties are security holes, as are trusted first parties...you should only trust your own self-hosted instance of The Mempool Open Source Project®.');
    this.ogService.setManualOgImage('privacy.jpg');

    this.themeStateSubscription = this.themeService.themeState$.subscribe((state) => {
      if (state.loading) {
        return;
      }
      this.loadedTheme = state.theme;
      this.cd.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.themeStateSubscription?.unsubscribe();
  }

  get isLightMode(): boolean {
    return this.loadedTheme === 'nymkappa';
  }
}
