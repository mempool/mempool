import { Component, OnInit } from '@angular/core';
import { StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-graphs',
  templateUrl: './graphs.component.html',
  styleUrls: ['./graphs.component.scss'],
})
export class GraphsComponent implements OnInit {
  padding = 'w-50';

  constructor(
    public stateService: StateService,
    private websocketService: WebsocketService
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);

    if (this.stateService.env.MINING_DASHBOARD === true && this.stateService.env.LIGHTNING === true) {
      this.padding = 'w-33';
    }
  }
}
