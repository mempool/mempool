import { Component, OnInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { Observable, merge, of } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';

@Component({
  selector: 'app-api-docs',
  templateUrl: './api-docs.component.html',
  styleUrls: ['./api-docs.component.scss']
})
export class ApiDocsComponent implements OnInit {
  hostname = document.location.hostname;
  network$: Observable<string>;
  active = 1;

  constructor(
    private stateService: StateService,
    private websocketService: WebsocketService,
    private seoService: SeoService,
  ) { }

  ngOnInit(): void {
    this.seoService.setTitle($localize`:@@e351b40b3869a5c7d19c3d4918cb1ac7aaab95c4:API`);
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.websocketService.want(['blocks']);

    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }
  }

}
