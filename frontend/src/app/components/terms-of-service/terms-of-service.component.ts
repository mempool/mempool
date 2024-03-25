import { Component } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { SeoService } from '../../services/seo.service';
import { OpenGraphService } from '../../services/opengraph.service';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html'
})
export class TermsOfServiceComponent {
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle('Terms of Service');
    this.seoService.setDescription('Out of respect for the Bitcoin community, the mempool.space website is Bitcoin Only and does not display any advertising.');
    this.ogService.setManualOgImage('tos.jpg');
  }
}
