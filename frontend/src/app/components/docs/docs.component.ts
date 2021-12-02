import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '../../services/state.service';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss']
})
export class DocsComponent implements OnInit {

  active = 0;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

  constructor(
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
  }

}
