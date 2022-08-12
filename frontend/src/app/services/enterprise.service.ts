import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { SeoService } from './seo.service';
import { StateService } from './state.service';

@Injectable({
  providedIn: 'root'
})
export class EnterpriseService {
  exclusiveHostName = '.mempool.space';
  subdomain: string | null = null;
  info: object = {};

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private apiService: ApiService,
    private seoService: SeoService,
    private stateService: StateService,
  ) {
    const subdomain = this.document.location.hostname.indexOf(this.exclusiveHostName) > -1
      && this.document.location.hostname.split(this.exclusiveHostName)[0] || false;
    if (subdomain && subdomain.match(/^[A-z0-9-_]+$/)) {
      this.subdomain = subdomain;
      this.fetchSubdomainInfo();
      this.disableSubnetworks();
    } else {
      this.insertMatomo();
    }
  }

  getSubdomain(): string {
    return this.subdomain;
  }

  disableSubnetworks(): void {
    this.stateService.env.TESTNET_ENABLED = false;
    this.stateService.env.LIQUID_ENABLED = false;
    this.stateService.env.LIQUID_TESTNET_ENABLED = false;
    this.stateService.env.SIGNET_ENABLED = false;
    this.stateService.env.BISQ_ENABLED = false;
  }

  fetchSubdomainInfo(): void {
    this.apiService.getEnterpriseInfo$(this.subdomain).subscribe((info) => {
      this.info = info;
      this.insertMatomo(info.site_id);
      this.seoService.setEnterpriseTitle(info.title);
    },
    (error) => {
      if (error.status === 404) {
        window.location.href = 'https://mempool.space' + window.location.pathname;
      }
    });
  }

  insertMatomo(siteId?: number): void {
    let statsUrl = '//stats.mempool.space/';
  
    if (!siteId) {
      siteId = 5;
      if (this.document.location.hostname === 'liquid.network') {
        statsUrl = '//stats.liquid.network/';
        siteId = 8;
      } else if (this.document.location.hostname === 'bisq.markets') {
        statsUrl = '//stats.bisq.markets/';
        siteId = 7;
      } else if (this.document.location.hostname !== 'mempool.space') {
        return;
      }
    }

    // @ts-ignore
    const _paq = window._paq = window._paq || [];
    _paq.push(['disableCookies']);
    _paq.push(['trackPageView']);
    _paq.push(['enableLinkTracking']);
    (function() {
      _paq.push(['setTrackerUrl', statsUrl+'m.php']);
      _paq.push(['setSiteId', siteId.toString()]);
      const d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
      g.type='text/javascript'; g.async=true; g.src=statsUrl+'m.js'; s.parentNode.insertBefore(g,s);
    })();
  }
}
