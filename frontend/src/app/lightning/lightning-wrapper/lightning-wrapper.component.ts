import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { WebsocketService } from '@app/services/websocket.service';
import { Router, ActivatedRoute } from '@angular/router';
import { handleDemoRedirect } from '../../shared/common.utils';

@Component({
  selector: 'app-lightning-wrapper',
  templateUrl: './lightning-wrapper.component.html',
  styleUrls: ['./lightning-wrapper.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningWrapperComponent implements OnInit {

  constructor(
    private websocketService: WebsocketService,
    private router: Router,
    private route: ActivatedRoute
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks']);

    handleDemoRedirect(this.route, this.router);
  }

}
