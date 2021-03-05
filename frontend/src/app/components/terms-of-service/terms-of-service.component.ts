import { Component } from '@angular/core';
import { Env, StateService } from '../../services/state.service';

@Component({
  selector: 'app-terms-of-service',
  templateUrl: './terms-of-service.component.html'
})
export class TermsOfServiceComponent {
  env: Env;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.env = this.stateService.env;
  }
}
