import { Component, OnInit } from '@angular/core';
import { StateService } from 'src/app/services/state.service';
import { WebsocketService } from 'src/app/services/websocket.service';
import { Observable, merge, of } from 'rxjs';

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
  ) { }

  ngOnInit(): void {
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.websocketService.want(['blocks']);

    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }
  }

}
