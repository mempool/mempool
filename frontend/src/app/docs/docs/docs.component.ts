import { Component, OnInit, HostBinding } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Env, StateService } from '../../services/state.service';
import { WebsocketService } from '../../services/websocket.service';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrls: ['./docs.component.scss']
})
export class DocsComponent implements OnInit {

  activeTab = 0;
  env: Env;
  showWebSocketTab = true;
  showFaqTab = true;

  @HostBinding('attr.dir') dir = 'ltr';

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private websocket: WebsocketService,
  ) { }

  ngOnInit(): void {
    this.websocket.want(['blocks']);
    const url = this.route.snapshot.url;
    if (url[0].path === "faq" ) {
        this.activeTab = 0;
    } else if( url[1].path === "rest" ) {
        this.activeTab = 1;
    } else {
        this.activeTab = 2;
    }

    this.env = this.stateService.env;
    this.showWebSocketTab = ( ! ( ( this.stateService.network === "bisq" ) || ( this.stateService.network === "liquidtestnet" ) ) );
    this.showFaqTab = ( this.env.BASE_MODULE === 'mempool' ) ? true : false;

    document.querySelector<HTMLElement>( "html" ).style.scrollBehavior = "smooth";
  }

  ngOnDestroy(): void {
    document.querySelector<HTMLElement>( "html" ).style.scrollBehavior = "auto";
  }
}
