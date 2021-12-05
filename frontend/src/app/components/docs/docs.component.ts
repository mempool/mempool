import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '../../services/state.service';
import { ParamMap, ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss']
})
export class DocsComponent implements OnInit {

  activeTab = 0;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,
    private route: ActivatedRoute,
  ) { }

  ngOnInit(): void {
    const requestedTab = this.route.snapshot.paramMap.get('tab');
    switch( requestedTab ) {
      case 'faq':
        this.activeTab = 0;
        break;
      case 'api':
        this.activeTab = 1;
        break;
      default:
        this.activeTab = 0;
        break;
    }
  }

}
