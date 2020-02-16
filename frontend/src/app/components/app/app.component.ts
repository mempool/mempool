import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    public router: Router,
    private websocketService: WebsocketService,
  ) { }
}
