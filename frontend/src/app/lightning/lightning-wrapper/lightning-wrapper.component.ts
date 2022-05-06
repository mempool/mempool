import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';

@Component({
  selector: 'app-lightning-wrapper',
  templateUrl: './lightning-wrapper.component.html',
  styleUrls: ['./lightning-wrapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningWrapperComponent {

  constructor(
    private websocketService: WebsocketService,
  ) { }

}
