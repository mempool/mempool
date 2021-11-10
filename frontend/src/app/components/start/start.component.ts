import { Component, OnInit } from '@angular/core';
import { WebsocketService } from 'src/app/services/websocket.service';
import { StateService } from 'src/app/services/state.service';
import { specialBlocks } from 'src/app/app.constants';

@Component({
  selector: 'app-start',
  templateUrl: './start.component.html',
  styleUrls: ['./start.component.scss'],
})
export class StartComponent implements OnInit {

  interval = 60;
  colors = ['#5E35B1', '#ffffff'];

  specialEvent = false;
  eventName = '';
  optionsLeft = {
    particleCount: 2,
    angle: 70,
    spread: 50,
    origin: { x: 0 },
    colors: this.colors,
  };
  optionsRight = {
    particleCount: 2,
    angle: 110,
    spread: 50,
    origin: { x: 1 },
    colors: this.colors,
  };

  constructor(
    private websocketService: WebsocketService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.websocketService.want(['blocks', 'stats', 'mempool-blocks']);
    this.stateService.blocks$
      .subscribe((blocks: any) => {
        const block = blocks[0];
        if(specialBlocks[block.height]) {
          this.specialEvent = true;
          this.eventName = specialBlocks[block.height].labelEvent;
          setTimeout(() => {
            this.specialEvent = false;
          }, 60 * 60 * 1000);
        }
      });
  }

}
