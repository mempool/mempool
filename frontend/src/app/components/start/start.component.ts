import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss']
})
export class StartComponent implements OnInit {
  view: 'blocks' | 'transactions' = 'blocks';

  isHalveningeEvent = false;

  constructor(
    private websocketService: WebsocketService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);

    this.stateService.blocks$
      .subscribe((block) => {
        if (block.height % 210000 === 0) {
          this.isHalveningeEvent = true;
          setTimeout(() => {
            this.isHalveningeEvent = false;
          }, 60 * 60 * 1000);
        }
      });
  }
}
