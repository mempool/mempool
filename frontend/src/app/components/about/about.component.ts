import { Component, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks']);
  }

}
