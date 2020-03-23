import { Component, OnInit } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss']
})
export class AboutComponent implements OnInit {

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
  ) { }

  ngOnInit() {
    this.seoService.setTitle('Contributors');
    this.websocketService.want(['blocks']);
  }

}
