import { Component, OnInit, HostBinding } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Env, StateService } from '@app/services/state.service';
import { WebsocketService } from '@app/services/websocket.service';
import { SeoService } from '@app/services/seo.service';
import { OpenGraphService } from '@app/services/opengraph.service';

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
  showElectrsTab = true;

  @HostBinding('attr.dir') dir = 'ltr';

  constructor(
    private route: ActivatedRoute,
    private stateService: StateService,
    private websocket: WebsocketService,
    private seoService: SeoService,
    private ogService: OpenGraphService,
  ) { }

  ngOnInit(): void {
    this.websocket.want(['blocks']);
    this.env = this.stateService.env;
    this.showFaqTab = ( this.env.BASE_MODULE === 'mempool' ) ? true : false;
    this.showElectrsTab = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;

    document.querySelector<HTMLElement>( "html" ).style.scrollBehavior = "smooth";
  }

  ngDoCheck(): void {

    const url = this.route.snapshot.url;

    if (url[0].path === "faq" ) {
      this.activeTab = 0;
      this.seoService.setTitle($localize`:@@meta.title.docs.faq:FAQ`);
      this.seoService.setDescription($localize`:@@meta.description.docs.faq:Get answers to common questions like: What is a mempool? Why isn't my transaction confirming? How can I run my own instance of The Mempool Open Source Project? And more.`);
      this.ogService.setManualOgImage('faq.jpg');
    } else if( url[1].path === "rest" ) {
      this.activeTab = 1;
      this.seoService.setTitle($localize`:@@meta.title.docs.rest:REST API`);
      if (this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ) {
        this.seoService.setDescription($localize`:@@meta.description.docs.rest-liquid:Documentation for the liquid.network REST API service: get info on addresses, transactions, assets, blocks, and more.`);
      } else {
        this.seoService.setDescription($localize`:@@meta.description.docs.rest-bitcoin:Documentation for the mempool.space REST API service: get info on addresses, transactions, blocks, fees, mining, the Lightning network, and more.`);
      }
    } else if( url[1].path === "websocket" ) {
      this.activeTab = 2;
      this.seoService.setTitle($localize`:@@meta.title.docs.websocket:WebSocket API`);
      if( this.stateService.network === 'liquid' || this.stateService.network === 'liquidtestnet' ) {
        this.seoService.setDescription($localize`:@@meta.description.docs.websocket-liquid:Documentation for the liquid.network WebSocket API service: get real-time info on blocks, mempools, transactions, addresses, and more.`);
      } else {
        this.seoService.setDescription($localize`:@@meta.description.docs.websocket-bitcoin:Documentation for the mempool.space WebSocket API service: get real-time info on blocks, mempools, transactions, addresses, and more.`);
      }
    } else {
      this.activeTab = 3;
      this.seoService.setTitle($localize`:@@meta.title.docs.electrum:Electrum RPC`);
      this.seoService.setDescription($localize`:@@meta.description.docs.electrumrpc:Documentation for our Electrum RPC interface: get instant, convenient, and reliable access to an Esplora instance.`);
    }
  }

  ngOnDestroy(): void {
    document.querySelector<HTMLElement>( "html" ).style.scrollBehavior = "auto";
  }
}
