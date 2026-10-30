import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { ApiService } from '@app/services/api.service';
import { SeoService } from '@app/services/seo.service';
import { StateService } from '@app/services/state.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class EnterpriseService {
  exclusiveHostName = '.mempool.space';
  subdomain: string | null = null;
  info$: BehaviorSubject<object> = new BehaviorSubject(null);

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private apiService: ApiService,
    private seoService: SeoService,
    private stateService: StateService,
  ) {
    const subdomain = this.stateService.env.customize?.enterprise || this.document.location.hostname.indexOf(this.exclusiveHostName) > -1
      && this.document.location.hostname.split(this.exclusiveHostName)[0] || false;
    if (subdomain && subdomain.match(/^[A-z0-9-_]+$/)) {
      this.subdomain = subdomain;
      this.fetchSubdomainInfo();
      this.disableSubnetworks();
      this.stateService.env.ACCELERATOR = false;
    }
  }

  getSubdomain(): string {
    return this.subdomain;
  }

  disableSubnetworks(): void {
    this.stateService.env.TESTNET_ENABLED = false;
    this.stateService.env.TESTNET4_ENABLED = false;
    this.stateService.env.LIQUID_ENABLED = false;
    this.stateService.env.LIQUID_TESTNET_ENABLED = false;
    this.stateService.env.SIGNET_ENABLED = false;
    this.stateService.env.REGTEST_ENABLED = false;
  }

  fetchSubdomainInfo(): void {
    if (this.stateService.env.customize?.branding) {
      const info = this.stateService.env.customize?.branding;
      this.seoService.setEnterpriseTitle(info.title, true);
      this.info$.next(this.processEnterpriseInfo(info));
    } else {
      this.apiService.getEnterpriseInfo$(this.subdomain).subscribe((info) => {
        this.seoService.setEnterpriseTitle(info.title);
        this.info$.next(this.processEnterpriseInfo(info));
      },
      (error) => {
        if (error.status === 404) {
          window.location.href = 'https://mempool.space' + window.location.pathname;
        }
      });
    }
  }

  private processEnterpriseInfo(info: any): any {
    const isCustomDashboard = this.stateService.env.customize?.dashboard?.widgets?.length > 0;
    const dualLogo = !isCustomDashboard || info.cobranded;
    const logoUrl = info.header_img ?? info.img ?? `/api/v1/services/enterprise/images/${this.subdomain}/logo`;
    return {
      ...info,
      dualLogo,
      logoUrl,
    };
  }
}
