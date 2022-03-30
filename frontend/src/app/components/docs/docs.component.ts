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

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
  ) { }

  ngOnInit(): void {
    const url = this.route.snapshot.url;
    this.activeTab = ( url[2].path === "rest" ) ? 0 : 1;
    this.env = this.stateService.env;
    this.showWebSocketTab = ( ! ( ( this.env.BASE_MODULE === "bisq" ) || ( this.stateService.network === "bisq" ) || ( this.stateService.network === "liquidtestnet" ) ) );
    document.querySelector<HTMLElement>( "html" ).style.scrollBehavior = "smooth";
  }

  ngOnDestroy(): void {
    document.querySelector<HTMLElement>( "html" ).style.scrollBehavior = "auto";
  }
}
