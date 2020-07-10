import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-bisq-explorer',
  templateUrl: './bisq-explorer.component.html',
  styleUrls: ['./bisq-explorer.component.scss']
})
export class BisqExplorerComponent implements OnInit {

  constructor(
    private websocketService: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.websocketService.want(['blocks']);
  }
}
