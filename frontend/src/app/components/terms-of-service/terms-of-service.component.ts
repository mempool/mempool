import { Component } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html'
})
export class TermsOfServiceComponent {
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Terms of Service');
    this.seoService.setDescription('Out of respect for the Bells community, the mempool.space website is Bells Only and does not display any advertising.');
  }
}
