import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';

@Component({
  selector: 'app-lightning-wrapper',
  templateUrl: './lightning-wrapper.component.html',
  styleUrls: ['./lightning-wrapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningWrapperComponent implements OnInit {

  constructor(
    private websocketService: WebsocketService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks']);
  }

}
