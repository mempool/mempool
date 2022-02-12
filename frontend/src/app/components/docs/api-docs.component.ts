import { Component, OnInit, Input, ViewChild, ElementRef } from '@angular/core';
import { Env, StateService } from 'src/app/services/state.service';
import { Observable, merge, of } from 'rxjs';
import { SeoService } from 'src/app/services/seo.service';
import { tap } from 'rxjs/operators';
import { restApiDocsData, wsApiDocsData } from './api-docs-data';

@Component({
  selector: 'app-api-docs',
  templateUrl: './api-docs.component.html',
  styleUrls: ['./api-docs.component.scss']
})
export class ApiDocsComponent implements OnInit {
  hostname = document.location.hostname;
  network$: Observable<string>;
  active = 0;
  env: Env;
  code: any;
  baseNetworkUrl = '';
  @Input() restTabActivated: Boolean;
  @ViewChild( "mobileFixedApiNav", { static: false } ) mobileFixedApiNav: ElementRef;
  desktopDocsNavPosition = "relative";
  showFloatingDocsNav = false;
  mobileMenuOpen = true;
  restDocs: any[];
  wsDocs: any;

  constructor(
    private stateService: StateService,
    private seoService: SeoService,
  ) { }

  ngAfterViewInit() {
    const that = this;
    setTimeout( () => {
      window.addEventListener('scroll', function() {
        that.desktopDocsNavPosition = ( window.pageYOffset > 182 ) ? "fixed" : "relative";
        that.showFloatingDocsNav = ( window.pageYOffset > ( that.mobileFixedApiNav.nativeElement.offsetHeight + 188 ) ) ? true : false;
      });
    }, 1 );
  }

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.seoService.setTitle($localize`:@@e351b40b3869a5c7d19c3d4918cb1ac7aaab95c4:API`);
    this.network$ = merge(of(''), this.stateService.networkChanged$).pipe(
      tap((network: string) => {
        if (this.env.BASE_MODULE === 'mempool' && network !== '') {
          this.baseNetworkUrl = `/${network}`;
        } else if (this.env.BASE_MODULE === 'liquid') {
          if (!['', 'liquid'].includes(network)) {
            this.baseNetworkUrl = `/${network}`;
          }
        }
        return network;
      })
    );

    if (document.location.port !== '') {
      this.hostname = `${this.hostname}:${document.location.port}`;
    }

    this.hostname = `${document.location.protocol}//${this.hostname}`;

    this.restDocs = restApiDocsData;
    this.wsDocs = wsApiDocsData;

    this.network$.subscribe((network) => {
      this.active = (network === 'liquid' || network === 'liquidtestnet') ? 2 : 0;
    });
  }

  wrapUrl(network: string, code: any, websocket: boolean = false) {

    let curlResponse = [];
    if (['', 'mainnet'].includes(network)){
      curlResponse = code.codeSampleMainnet.curl;
    }
    if (network === 'testnet') {
      curlResponse = code.codeSampleTestnet.curl;
    }
    if (network === 'signet') {
      curlResponse = code.codeSampleSignet.curl;
    }
    if (network === 'liquid') {
      curlResponse = code.codeSampleLiquid.curl;
    }
    if (network === 'liquidtestnet') {
      curlResponse = code.codeSampleLiquidTestnet.curl;
    }
    if (network === 'bisq') {
      curlResponse = code.codeSampleBisq.curl;
    }

    let curlNetwork = '';
    if (this.env.BASE_MODULE === 'mempool') {
      if (!['', 'mainnet'].includes(network)) {
        curlNetwork = `/${network}`;
      }
    } else if (this.env.BASE_MODULE === 'liquid') {
      if (!['', 'liquid'].includes(network)) {
        curlNetwork = `/${network}`;
      }
    }

    let text = code.codeTemplate.curl;
    for (let index = 0; index < curlResponse.length; index++) {
      const curlText = curlResponse[index];
      const indexNumber = index + 1;
      text = text.replace('%{' + indexNumber + '}', curlText);
    }

    if (websocket) {
      const wsHostname = this.hostname.replace('https://', 'wss://');
      wsHostname.replace('http://', 'ws://');
      return `${wsHostname}${curlNetwork}${text}`;
    }
    return `${this.hostname}${curlNetwork}${text}`;
  }

}

