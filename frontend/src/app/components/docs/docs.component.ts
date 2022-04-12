import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Env, StateService } from 'src/app/services/state.service';

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

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    const url = this.route.snapshot.url;
    if( url[1].path === "faq" ) {
        this.activeTab = 0;
    } else if( url[2].path === "rest" ) {
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
