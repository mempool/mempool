import { Component, OnInit } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';

@Component({
  selector: 'app-status-view',
  templateUrl: './status-view.component.html'
})
export class StatusViewComponent implements OnInit {
  constructor(
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['mempool-blocks', 'stats', 'blocks']);
  }
}
