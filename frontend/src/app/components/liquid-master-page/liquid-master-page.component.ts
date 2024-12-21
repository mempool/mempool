import { Component, OnInit } from '@angular/core';
import { Env, StateService } from '@app/services/state.service';
import { merge, Observable, of} from 'rxjs';
import { LanguageService } from '@app/services/language.service';
import { EnterpriseService } from '@app/services/enterprise.service';
import { NavigationService } from '@app/services/navigation.service';

@Component({
  selector: 'app-liquid-master-page',
  templateUrl: './liquid-master-page.component.html',
  styleUrls: ['./liquid-master-page.component.scss'],
})
export class LiquidMasterPageComponent implements OnInit {
  env: Env;
  connectionState$: Observable<number>;
  navCollapsed = false;
  isMobile = window.innerWidth <= 767.98;
  officialMempoolSpace = this.stateService.env.OFFICIAL_MEMPOOL_SPACE;
  network$: Observable<string>;
  urlLanguage: string;
  networkPaths: { [network: string]: string };
  footerVisible = true;

  constructor(
    private stateService: StateService,
    private languageService: LanguageService,
    private enterpriseService: EnterpriseService,
    private navigationService: NavigationService,
  ) { }

  ngOnInit(): void {
    this.env = this.stateService.env;
    this.connectionState$ = this.stateService.connectionState$;
    this.network$ = merge(of(''), this.stateService.networkChanged$);
    this.urlLanguage = this.languageService.getLanguageForUrl();
    this.navigationService.subnetPaths.subscribe((paths) => {
      this.networkPaths = paths;
      if (paths.liquid.indexOf('docs') > -1) {
        this.footerVisible = false;
      } else {
        this.footerVisible = true;
      }
    });
  }

  collapse(): void {
    this.navCollapsed = !this.navCollapsed;
  }

  onResize(): void {
    this.isMobile = window.innerWidth <= 767.98;
  }
}
