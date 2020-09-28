import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { WebsocketService } from '../../services/websocket.service';
import { SeoService } from 'src/app/services/seo.service';
import { StateService } from 'src/app/services/state.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-about',
  templateUrl: './about.component.html',
  styleUrls: ['./about.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutComponent implements OnInit {
  active = 1;
  hostname = document.location.hostname;
  gitCommit$: Observable<string>;

  constructor(
    private websocketService: WebsocketService,
    private seoService: SeoService,
    private stateService: StateService,
  ) { }

  ngOnInit() {
    this.gitCommit$ = this.stateService.gitCommit$;
    this.seoService.setTitle('About');
    this.websocketService.want(['blocks']);
    if (this.stateService.network === 'bisq') {
      this.active = 2;
    }
    if (document.location.port !== '') {
      this.hostname = this.hostname + ':' + document.location.port;
    }
  }
}
