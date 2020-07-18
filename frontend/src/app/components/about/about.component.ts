import { Component, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {
  active = 1;
  hostname = document.location.hostname;


  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle('Contributors');
    this.websocketService.want(['blocks']);
    if (this.stateService.network === 'bisq') {
      this.active = 2;
    }
    if (document.location.port !== '443') {
      this.hostname = this.hostname + ':' + document.location.port;
    }
  }
}
