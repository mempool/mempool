import { Component } from '@angular/core';
import { Env, StateService } from '../../services/state.service';

@Component({
  selector: 'app-trademark-policy',
  templateUrl: './trademark-policy.component.html',
  styleUrls: ['./trademark-policy.component.scss']
})
export class TrademarkPolicyComponent {
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,
  ) { }
}
