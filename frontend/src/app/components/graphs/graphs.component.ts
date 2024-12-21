import { Component, OnInit } from '@angular/core';
import { StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { Router, ActivatedRoute } from '@angular/router';
import { handleDemoRedirect } from '../../shared/common.utils';

@Component({
  selector: 'app-graphs',
  templateUrl: './graphs.component.html',
  styleUrls: ['./graphs.component.scss'],
})
export class GraphsComponent implements OnInit {
  flexWrap = false;
  isMainnet = this.stateService.isMainnet();

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);

    if (this.stateService.env.ACCELERATOR === true && (this.stateService.env.MINING_DASHBOARD === true || this.stateService.env.LIGHTNING === true)) {
      this.flexWrap = true;
    }

    handleDemoRedirect(this.route, this.router);
  }
}
