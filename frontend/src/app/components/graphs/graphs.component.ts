import { Component, OnInit } from '@angular/core';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

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
    private websocketService: WebsocketService
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);

    if (this.stateService.env.ACCELERATOR === true && (this.stateService.env.MINING_DASHBOARD === true || this.stateService.env.LIGHTNING === true)) {
      this.flexWrap = true;
    }
  }
}
