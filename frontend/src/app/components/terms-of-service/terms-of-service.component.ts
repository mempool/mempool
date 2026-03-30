import { ChangeDetectorRef, Component } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';
import { Subscription } from 'rxjs';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html',
  standalone: false,
})
export class TermsOfServiceComponent {
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
    this.seoService.setTitle('Terms of Service');
    this.seoService.setDescription('Out of respect for the Bitcoin community, the mempool.space website is Bitcoin Only and does not display any advertising.');
    this.ogService.setManualOgImage('tos.jpg');

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
