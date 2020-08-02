import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
})
export class StartComponent implements OnInit {
  constructor(
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);
  }
}
